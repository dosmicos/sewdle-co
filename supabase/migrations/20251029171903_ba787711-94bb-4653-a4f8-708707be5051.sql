-- Drop existing function
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

-- Recreate function with corrected pending_production CTE
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_result jsonb;
BEGIN
  -- Delete previous calculations for this organization (keep today's date filter)
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment calculations
  WITH 
  -- Get current stock from Shopify inventory
  current_inventory AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(si.quantity_available, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_inventory si ON pv.shopify_variant_id = si.shopify_variant_id
    WHERE p.organization_id = org_id
  ),
  
  -- Calculate pending production using workshop_assignments
  pending_production AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(
        SUM(oi.quantity) - COALESCE(SUM(di.quantity_approved), 0),
        0
      ) as pending_qty
    FROM workshop_assignments wa
    JOIN orders o ON wa.order_id = o.id
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN delivery_items di ON oi.id = di.order_item_id
    WHERE wa.organization_id = org_id
      AND wa.status IN ('pending', 'in_progress', 'assigned')
      AND o.status NOT IN ('completed', 'cancelled')
    GROUP BY oi.product_variant_id
  ),
  
  -- Get sales data from last 30 days
  sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soi.quantity), 0) as sales_30d,
      COUNT(DISTINCT so.id) as orders_count_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_items soi ON pv.shopify_variant_id = soi.shopify_variant_id
    LEFT JOIN shopify_orders so ON soi.shopify_order_id = so.id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND p.organization_id = org_id
      AND so.organization_id = org_id
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  
  -- Calculate metrics and generate suggestions
  replenishment_calc AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      ci.current_stock,
      COALESCE(pp.pending_qty, 0) as pending_production,
      sd.sales_30d,
      sd.orders_count_30d,
      ROUND(sd.sales_30d::numeric / 30, 2) as avg_daily_sales,
      CASE 
        WHEN sd.sales_30d > 0 THEN 
          ROUND((ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (sd.sales_30d::numeric / 30), 1)
        ELSE NULL
      END as days_of_supply,
      ROUND(sd.sales_30d::numeric / 30 * 30, 0) as projected_30d_demand,
      CASE 
        WHEN sd.sales_30d > 0 THEN
          GREATEST(
            ROUND(sd.sales_30d::numeric / 30 * 30, 0) - (ci.current_stock + COALESCE(pp.pending_qty, 0)),
            0
          )
        ELSE 0
      END as suggested_quantity,
      CASE 
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0)) = 0 AND sd.sales_30d > 0 THEN 'critical'
        WHEN sd.sales_30d > 0 AND (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (sd.sales_30d::numeric / 30) < 7 THEN 'high'
        WHEN sd.sales_30d > 0 AND (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (sd.sales_30d::numeric / 30) < 14 THEN 'medium'
        ELSE 'low'
      END as urgency,
      CASE 
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0)) = 0 AND sd.sales_30d > 0 THEN 'Sin stock y con ventas recientes'
        WHEN sd.sales_30d > 0 AND (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (sd.sales_30d::numeric / 30) < 7 THEN 'Stock bajo - menos de 7 días'
        WHEN sd.sales_30d > 0 AND (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (sd.sales_30d::numeric / 30) < 14 THEN 'Stock moderado - menos de 14 días'
        ELSE 'Stock suficiente'
      END as reason,
      CASE 
        WHEN sd.orders_count_30d >= 5 THEN 'high'
        WHEN sd.orders_count_30d >= 2 THEN 'medium'
        ELSE 'low'
      END as data_confidence
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    JOIN current_inventory ci ON pv.id = ci.variant_id
    LEFT JOIN pending_production pp ON pv.id = pp.variant_id
    LEFT JOIN sales_data sd ON pv.id = sd.variant_id
    WHERE p.organization_id = org_id
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
    status,
    calculation_date
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
    urgency,
    reason,
    data_confidence,
    'pending',
    CURRENT_DATE
  FROM replenishment_calc;
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  v_result := jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'organization_id', org_id,
    'calculation_date', CURRENT_DATE
  );
  
  RETURN v_result;
END;
$$;