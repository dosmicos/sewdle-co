-- Fix sales calculation in refresh_inventory_replenishment function
-- Include paid, partially_paid, authorized orders and exclude cancelled ones

-- Drop existing function
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

-- Recreate function with corrected sales calculation
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS TABLE (inserted integer) AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Delete existing records for today
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment calculations
  WITH sales_data AS (
    SELECT 
      soli.sku,
      COUNT(DISTINCT so.shopify_order_id) as orders_count,
      SUM(soli.quantity) as total_quantity
    FROM shopify_order_line_items soli
    JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id  
    WHERE soli.organization_id = org_id
      AND so.created_at >= NOW() - INTERVAL '30 days'
      -- Include valid payment statuses
      AND so.financial_status IN ('paid', 'partially_paid', 'authorized')
      -- Exclude cancelled orders
      AND so.cancelled_at IS NULL
      -- Only confirmed orders
      AND so.confirmed = true
    GROUP BY soli.sku
  ),
  current_inventory AS (
    SELECT 
      pv.id as variant_id,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    WHERE pv.organization_id = org_id
  ),
  pending_orders AS (
    SELECT 
      pv.sku_variant,
      COALESCE(SUM(oi.quantity), 0) as pending_quantity
    FROM order_items oi
    JOIN product_variants pv ON oi.product_variant_id = pv.id
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production', 'ready')
    GROUP BY pv.sku_variant
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
    status
  )
  SELECT 
    org_id,
    ci.variant_id,
    CURRENT_DATE,
    ci.current_stock,
    COALESCE(po.pending_quantity, 0) as pending_production,
    COALESCE(sd.total_quantity, 0) as sales_30d,
    COALESCE(sd.orders_count, 0) as orders_count_30d,
    ROUND(COALESCE(sd.total_quantity, 0)::numeric / 30, 2) as avg_daily_sales,
    CASE 
      WHEN COALESCE(sd.total_quantity, 0) > 0 
      THEN ROUND((ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric / (sd.total_quantity::numeric / 30), 1)
      ELSE NULL
    END as days_of_supply,
    ROUND((COALESCE(sd.total_quantity, 0)::numeric / 30) * 40, 0) as projected_demand_40d,
    CASE
      WHEN COALESCE(sd.total_quantity, 0) = 0 THEN 0
      ELSE GREATEST(0, 
        ROUND((COALESCE(sd.total_quantity, 0)::numeric / 30) * 40, 0) - 
        (ci.current_stock + COALESCE(po.pending_quantity, 0))
      )
    END as suggested_quantity,
    CASE
      WHEN COALESCE(sd.total_quantity, 0) = 0 THEN 'low'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 7 THEN 'critical'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 14 THEN 'high'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    CASE
      WHEN COALESCE(sd.total_quantity, 0) = 0 THEN 'Sin ventas en últimos 30 días'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 7 
        THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 14 
        THEN 'Stock bajo: menos de 14 días de inventario'
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 30 
        THEN 'Reabastecer pronto: menos de 30 días de inventario'
      ELSE 'Stock suficiente'
    END as reason,
    CASE
      WHEN COALESCE(sd.orders_count, 0) >= 10 THEN 'high'
      WHEN COALESCE(sd.orders_count, 0) >= 3 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    'pending' as status
  FROM current_inventory ci
  LEFT JOIN sales_data sd ON ci.sku_variant = sd.sku
  LEFT JOIN pending_orders po ON ci.sku_variant = po.sku_variant
  WHERE COALESCE(sd.total_quantity, 0) > 0 -- Only include variants with sales
  ORDER BY 
    CASE
      WHEN COALESCE(sd.total_quantity, 0) = 0 THEN 4
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 7 THEN 1
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 14 THEN 2
      WHEN (ci.current_stock + COALESCE(po.pending_quantity, 0))::numeric <= (sd.total_quantity::numeric / 30) * 30 THEN 3
      ELSE 4
    END,
    sd.total_quantity DESC;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN QUERY SELECT inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;