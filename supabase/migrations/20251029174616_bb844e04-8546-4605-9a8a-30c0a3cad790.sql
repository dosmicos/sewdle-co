-- Fix column references in refresh_inventory_replenishment function
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Delete today's existing records for this org
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment suggestions
  WITH sales_30d AS (
    SELECT 
      pv.id as variant_id,
      COUNT(DISTINCT soli.order_id) as orders_count_30d,
      COALESCE(SUM(soli.quantity), 0)::INTEGER as sales_30d,
      ROUND(COALESCE(SUM(soli.quantity), 0) / 30.0, 2) as avg_daily_sales
    FROM shopify_order_line_items soli
    INNER JOIN shopify_orders so ON soli.order_id = so.id
    INNER JOIN product_variants pv ON soli.sku = pv.sku_variant
    INNER JOIN products p ON pv.product_id = p.id
    WHERE so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid')
      AND so.fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')
    GROUP BY pv.id
  ),
  pending_prod AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0)::INTEGER as pending_production
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY oi.product_variant_id
  ),
  current_inventory AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  replenishment_data AS (
    SELECT
      ci.variant_id,
      p.name as product_name,
      pv.sku_variant,
      pv.size as variant_size,
      pv.color as variant_color,
      ci.current_stock,
      COALESCE(pp.pending_production, 0) as pending_production,
      COALESCE(s.sales_30d, 0) as sales_30d,
      COALESCE(s.orders_count_30d, 0) as orders_count_30d,
      COALESCE(s.avg_daily_sales, 0) as avg_daily_sales,
      CASE 
        WHEN COALESCE(s.avg_daily_sales, 0) > 0 
        THEN ROUND((ci.current_stock + COALESCE(pp.pending_production, 0)) / s.avg_daily_sales, 1)
        ELSE NULL
      END as days_of_supply,
      ROUND(COALESCE(s.avg_daily_sales, 0) * 30, 0)::INTEGER as projected_30d_demand,
      CASE
        WHEN COALESCE(s.avg_daily_sales, 0) = 0 THEN 0
        ELSE GREATEST(
          0,
          ROUND(COALESCE(s.avg_daily_sales, 0) * 45)::INTEGER - 
          (ci.current_stock + COALESCE(pp.pending_production, 0))
        )
      END as suggested_quantity,
      CASE
        WHEN COALESCE(s.orders_count_30d, 0) >= 10 THEN 'high'
        WHEN COALESCE(s.orders_count_30d, 0) >= 3 THEN 'medium'
        ELSE 'low'
      END as data_confidence
    FROM current_inventory ci
    INNER JOIN product_variants pv ON ci.variant_id = pv.id
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_30d s ON ci.variant_id = s.variant_id
    LEFT JOIN pending_prod pp ON ci.variant_id = pp.variant_id
    WHERE p.organization_id = org_id
      AND COALESCE(s.sales_30d, 0) > 0
  )
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
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
    calculation_date,
    status
  )
  SELECT
    org_id,
    variant_id,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    CASE
      WHEN days_of_supply IS NULL OR days_of_supply <= 7 THEN 'critical'
      WHEN days_of_supply <= 14 THEN 'high'
      WHEN days_of_supply <= 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    CASE
      WHEN days_of_supply IS NULL THEN 'Sin stock y con demanda activa'
      WHEN days_of_supply <= 7 THEN 'Stock crítico: menos de 1 semana de inventario'
      WHEN days_of_supply <= 14 THEN 'Stock bajo: menos de 2 semanas de inventario'
      WHEN days_of_supply <= 30 THEN 'Reposición recomendada'
      ELSE 'Stock suficiente'
    END as reason,
    data_confidence,
    CURRENT_DATE,
    'pending'
  FROM replenishment_data
  WHERE suggested_quantity > 0;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculation_date', CURRENT_DATE
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'calculation_date', CURRENT_DATE
    );
END;
$$;