-- Drop and recreate refresh_inventory_replenishment function with correct status
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Delete existing records for today for this organization
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new calculations with deduplication for sales
  WITH sales_data AS (
    SELECT 
      pv.id AS variant_id,
      COALESCE(SUM(distinct_items.quantity), 0) AS sales_30d,
      COUNT(DISTINCT distinct_items.shopify_order_id) AS orders_count_30d
    FROM product_variants pv
    LEFT JOIN LATERAL (
      SELECT DISTINCT ON (soi.shopify_order_id, soi.sku)
        soi.shopify_order_id,
        soi.sku,
        soi.quantity,
        soi.created_at
      FROM shopify_order_line_items soi
      INNER JOIN shopify_orders so ON soi.shopify_order_id = so.shopify_order_id
      WHERE soi.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND so.cancelled_at IS NULL
      ORDER BY soi.shopify_order_id, soi.sku, soi.created_at DESC
    ) distinct_items ON true
    WHERE pv.product_id IN (
      SELECT id FROM products WHERE organization_id = org_id
    )
    GROUP BY pv.id
  ),
  pending_production AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0) AS pending_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY oi.product_variant_id
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
    projected_demand_40d,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status,
    calculated_at
  )
  SELECT 
    org_id,
    pv.id,
    CURRENT_DATE,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    sd.sales_30d,
    sd.orders_count_30d,
    ROUND(sd.sales_30d / 30.0, 2),
    CASE 
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 
      THEN ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1)
      ELSE 999
    END,
    ROUND(ROUND(sd.sales_30d / 30.0, 2) * 40, 0),
    GREATEST(
      0,
      ROUND(ROUND(sd.sales_30d / 30.0, 2) * 40, 0) - (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0))
    ),
    CASE 
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 AND 
           ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1) < 7
      THEN 'critical'
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 AND 
           ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1) < 14
      THEN 'high'
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 AND 
           ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1) < 21
      THEN 'medium'
      ELSE 'low'
    END,
    CASE 
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 AND 
           ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1) < 7
      THEN 'Stock crítico: menos de 1 semana de inventario'
      WHEN ROUND(sd.sales_30d / 30.0, 2) > 0 AND 
           ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (sd.sales_30d / 30.0), 1) < 14
      THEN 'Stock bajo: menos de 2 semanas de inventario'
      WHEN sd.sales_30d = 0
      THEN 'Sin ventas en los últimos 30 días'
      ELSE 'Stock adecuado'
    END,
    CASE 
      WHEN sd.orders_count_30d >= 10 THEN 'high'
      WHEN sd.orders_count_30d >= 3 THEN 'medium'
      ELSE 'low'
    END,
    'pending',
    NOW()
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  INNER JOIN sales_data sd ON sd.variant_id = pv.id
  LEFT JOIN pending_production pp ON pp.product_variant_id = pv.id
  WHERE p.organization_id = org_id
    AND p.status = 'active'
    AND (sd.sales_30d > 0 OR COALESCE(pv.stock_quantity, 0) > 0);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculation_date', CURRENT_DATE
  );
END;
$$;