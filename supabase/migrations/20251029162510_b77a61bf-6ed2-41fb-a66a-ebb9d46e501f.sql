-- Fix JOIN to use shopify_order_id instead of order_id
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculation_date DATE;
  v_inserted_count INTEGER;
BEGIN
  v_calculation_date := CURRENT_DATE;
  
  -- Delete existing suggestions for today
  DELETE FROM inventory_replenishment
  WHERE calculation_date = v_calculation_date
    AND organization_id = org_id;

  -- CTE for pending production from internal orders
  WITH pending_production AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as total_pending
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY oi.product_variant_id
  ),
  sales_data AS (
    SELECT 
      soli.variant_id,
      COUNT(DISTINCT so.id) as orders_count_30d,
      SUM(soli.quantity) as sales_30d
    FROM shopify_order_line_items soli
    JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    WHERE so.organization_id = org_id
      AND so.created_at >= NOW() - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid')
    GROUP BY soli.variant_id
  ),
  inventory_data AS (
    SELECT 
      variant_id,
      SUM(quantity) as current_stock
    FROM material_inventory
    WHERE organization_id = org_id
    GROUP BY variant_id
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
    pv.id as variant_id,
    COALESCE(inv.current_stock, 0) as current_stock,
    COALESCE(pp.total_pending, 0) as pending_production,
    COALESCE(sd.sales_30d, 0) as sales_30d,
    COALESCE(sd.orders_count_30d, 0) as orders_count_30d,
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0, 2) as avg_daily_sales,
    CASE 
      WHEN COALESCE(sd.sales_30d, 0) > 0 THEN
        ROUND((COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0), 1)
      ELSE NULL
    END as days_of_supply,
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0 * 30, 0) as projected_30d_demand,
    GREATEST(0, ROUND(
      (COALESCE(sd.sales_30d, 0) / 30.0 * 40) - 
      COALESCE(inv.current_stock, 0) - 
      COALESCE(pp.total_pending, 0),
      0
    )) as suggested_quantity,
    CASE 
      WHEN COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0) <= 0 THEN 'critical'
      WHEN (COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 7 THEN 'high'
      WHEN (COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 14 THEN 'medium'
      ELSE 'low'
    END as urgency,
    CASE 
      WHEN COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0) <= 0 THEN 'Sin stock disponible'
      WHEN (COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 7 THEN 'Menos de 1 semana de inventario'
      WHEN (COALESCE(inv.current_stock, 0) + COALESCE(pp.total_pending, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 14 THEN 'Menos de 2 semanas de inventario'
      ELSE 'Nivel de inventario adecuado'
    END as reason,
    CASE 
      WHEN COALESCE(sd.orders_count_30d, 0) >= 5 THEN 'high'
      WHEN COALESCE(sd.orders_count_30d, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    v_calculation_date,
    'pending'
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN inventory_data inv ON pv.id = inv.variant_id
  LEFT JOIN pending_production pp ON pv.id = pp.variant_id
  LEFT JOIN sales_data sd ON pv.id = sd.variant_id
  WHERE p.organization_id = org_id
    AND pv.sku_variant IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
    );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'calculation_date', v_calculation_date
  );
END;
$$;