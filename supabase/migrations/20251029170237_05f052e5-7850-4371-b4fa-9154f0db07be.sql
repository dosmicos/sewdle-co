-- Corregir CTE sales_data en refresh_inventory_replenishment para usar shopify_order_line_items
-- Esto mejora la eficiencia y corrige el cálculo de ventas 30d

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count integer := 0;
  today_date date := CURRENT_DATE;
BEGIN
  -- CTE for pending production quantities
  WITH pending_production AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as total_pending
    FROM product_variants pv
    LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY pv.id
  ),
  -- CTE for sales data from Shopify (using SKU match)
  sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COALESCE(COUNT(DISTINCT so.shopify_order_id), 0) as orders_count
    FROM product_variants pv
    LEFT JOIN shopify_order_line_items soli 
      ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so 
      ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '30 days'
      AND so.created_at_shopify <= CURRENT_DATE
      AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
      AND so.cancelled_at IS NULL
    WHERE pv.organization_id = org_id
    GROUP BY pv.id
  )
  
  INSERT INTO inventory_replenishment (
    variant_id,
    calculation_date,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status,
    organization_id
  )
  SELECT 
    pv.id as variant_id,
    today_date as calculation_date,
    COALESCE(pv.stock_quantity, 0) as current_stock,
    COALESCE(pp.total_pending, 0) as pending_production,
    sd.sales_30d,
    sd.orders_count as orders_count_30d,
    ROUND(sd.sales_30d::numeric / 30.0, 2) as avg_daily_sales,
    
    -- Days of supply
    CASE 
      WHEN sd.sales_30d = 0 THEN NULL
      ELSE ROUND(
        (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
        sd.sales_30d::numeric,
        1
      )
    END as days_of_supply,
    
    -- Projected 30d demand
    GREATEST(0, sd.sales_30d::numeric) as projected_30d_demand,
    
    -- Suggested quantity (avg_daily_sales * 40) - stock - pending
    GREATEST(
      0,
      ROUND(
        (ROUND(sd.sales_30d::numeric / 30.0, 2) * 40) - 
        COALESCE(pv.stock_quantity, 0) - 
        COALESCE(pp.total_pending, 0),
        0
      )
    ) as suggested_quantity,
    
    -- Urgency level
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
           AND sd.sales_30d > 0 
           AND COALESCE(pp.total_pending, 0) = 0
      THEN 'critical'
      
      WHEN sd.sales_30d > 0 AND
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(sd.sales_30d::numeric, 0) < 7
      THEN 'high'
      
      WHEN sd.sales_30d > 0 AND
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(sd.sales_30d::numeric, 0) < 15
      THEN 'medium'
      
      ELSE 'low'
    END as urgency,
    
    -- Reason
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
           AND sd.sales_30d > 0 
           AND COALESCE(pp.total_pending, 0) = 0
      THEN 'Sin stock y con demanda activa'
      
      WHEN sd.sales_30d > 0 AND
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(sd.sales_30d::numeric, 0) < 7
      THEN 'Stock muy bajo: menos de 7 días'
      
      WHEN sd.sales_30d > 0 AND
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(sd.sales_30d::numeric, 0) < 15
      THEN 'Stock bajo: menos de 15 días'
      
      ELSE 'Reposición preventiva basada en proyección a 40 días'
    END as reason,
    
    -- Data confidence
    CASE
      WHEN sd.orders_count >= 5 THEN 'high'
      WHEN sd.orders_count >= 2 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    
    'pending' as status,
    org_id as organization_id
    
  FROM product_variants pv
  LEFT JOIN pending_production pp ON pv.id = pp.variant_id
  LEFT JOIN sales_data sd ON pv.id = sd.variant_id
  WHERE pv.organization_id = org_id
    AND pv.sku_variant IS NOT NULL
    AND pv.sku_variant != ''
    AND pv.active = true
    AND sd.sales_30d > 0  -- Solo productos con ventas en últimos 30 días
  ON CONFLICT (variant_id, calculation_date) 
  DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    pending_production = EXCLUDED.pending_production,
    sales_30d = EXCLUDED.sales_30d,
    orders_count_30d = EXCLUDED.orders_count_30d,
    avg_daily_sales = EXCLUDED.avg_daily_sales,
    days_of_supply = EXCLUDED.days_of_supply,
    projected_30d_demand = EXCLUDED.projected_30d_demand,
    suggested_quantity = EXCLUDED.suggested_quantity,
    urgency = EXCLUDED.urgency,
    reason = EXCLUDED.reason,
    data_confidence = EXCLUDED.data_confidence,
    calculated_at = now();
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculation_date', today_date
  );
END;
$$;

COMMENT ON FUNCTION refresh_inventory_replenishment IS 'Calcula sugerencias de reposición usando ventas reales de Shopify (30 días) vinculadas por SKU';