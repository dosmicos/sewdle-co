-- Eliminar y recrear refresh_inventory_replenishment con el filtro corregido
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS TABLE(inserted integer) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- CTE para calcular ventas de los últimos 30 días desde shopify_order_line_items
  WITH sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COALESCE(COUNT(DISTINCT so.shopify_order_id), 0) as orders_count
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli 
      ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so 
      ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '30 days'
      AND so.created_at_shopify <= CURRENT_DATE
      AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
      AND so.cancelled_at IS NULL
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  pending_production AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(wo.quantity), 0) as pending_qty
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN workshop_orders wo 
      ON pv.id = wo.product_variant_id
      AND wo.status IN ('pending', 'in_progress', 'assigned')
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  )
  INSERT INTO inventory_replenishment (
    organization_id,
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
    data_confidence
  )
  SELECT 
    p.organization_id,
    pv.id,
    CURRENT_DATE,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    COALESCE(sd.sales_30d, 0),
    COALESCE(sd.orders_count, 0),
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0, 2),
    CASE 
      WHEN COALESCE(sd.sales_30d, 0) > 0 THEN 
        ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0), 1)
      ELSE 999
    END,
    ROUND(COALESCE(sd.sales_30d, 0) * 1.2, 0),
    CASE
      WHEN COALESCE(sd.sales_30d, 0) > 0 THEN
        GREATEST(0, ROUND(COALESCE(sd.sales_30d, 0) * 1.5 - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.pending_qty, 0), 0))
      ELSE 0
    END,
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0) < 7 THEN 'high'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0) < 14 THEN 'medium'
      ELSE 'low'
    END,
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 
        'Stock agotado con demanda activa'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0) < 7 THEN
        'Inventario crítico: menos de 7 días de cobertura'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
           (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0) < 14 THEN
        'Nivel de inventario bajo: menos de 14 días'
      ELSE 'Inventario adecuado'
    END,
    CASE
      WHEN COALESCE(sd.orders_count, 0) >= 3 THEN 'high'
      WHEN COALESCE(sd.orders_count, 0) >= 1 THEN 'medium'
      ELSE 'low'
    END
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_data sd ON pv.id = sd.variant_id
  LEFT JOIN pending_production pp ON pv.id = pp.variant_id
  WHERE p.organization_id = org_id
  ON CONFLICT (organization_id, variant_id, calculation_date) 
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
    updated_at = now();

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN QUERY SELECT inserted_count;
END;
$$;