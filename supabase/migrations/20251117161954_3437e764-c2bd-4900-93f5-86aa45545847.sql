-- Drop existing function and view to recreate with correct joins
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);
DROP VIEW IF EXISTS v_replenishment_details;

-- Recreate the function with corrected joins and data types
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_count integer;
BEGIN
  -- Calculate sales data from Shopify orders (last 30 days)
  WITH sales_data AS (
    SELECT 
      pv.id AS product_variant_id,
      COUNT(DISTINCT so.id) AS orders_count_30d,
      COALESCE(SUM(soi.quantity), 0) AS sales_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soi 
      ON pv.sku_variant = soi.sku::text
    LEFT JOIN shopify_orders so 
      ON soi.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'authorized')
      AND so.cancelled_at IS NULL
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  -- Get current stock levels
  stock_data AS (
    SELECT 
      pv.id AS product_variant_id,
      COALESCE(pv.stock_quantity, 0) AS current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  -- Calculate pending production (orders not yet delivered)
  pending_data AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity - COALESCE(delivered.total_delivered, 0)), 0) AS pending_production
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN (
      SELECT 
        di.order_item_id,
        SUM(di.quantity_delivered) AS total_delivered
      FROM delivery_items di
      GROUP BY di.order_item_id
    ) delivered ON oi.id = delivered.order_item_id
    WHERE o.organization_id = org_id
      AND o.status NOT IN ('cancelled', 'completed')
    GROUP BY oi.product_variant_id
  ),
  -- Combine all data and calculate metrics
  combined_data AS (
    SELECT 
      pv.id AS variant_id,
      COALESCE(sd.sales_30d, 0) AS sales_30d,
      COALESCE(sd.orders_count_30d, 0) AS orders_count_30d,
      COALESCE(stock.current_stock, 0) AS current_stock,
      COALESCE(pd.pending_production, 0) AS pending_production,
      -- Calculate average daily sales
      CASE 
        WHEN COALESCE(sd.sales_30d, 0) > 0 THEN ROUND(COALESCE(sd.sales_30d, 0)::numeric / 30, 2)
        ELSE 0
      END AS avg_daily_sales,
      -- Calculate days of supply
      CASE 
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND COALESCE(stock.current_stock, 0) > 0 
        THEN ROUND((COALESCE(stock.current_stock, 0)::numeric / (COALESCE(sd.sales_30d, 0)::numeric / 30)), 1)
        ELSE NULL
      END AS days_of_supply,
      -- Project demand for next 40 days
      ROUND(COALESCE(sd.sales_30d, 0)::numeric / 30 * 40) AS projected_demand_40d,
      -- Calculate suggested quantity
      GREATEST(0, 
        ROUND(COALESCE(sd.sales_30d, 0)::numeric / 30 * 40) - 
        COALESCE(stock.current_stock, 0) - 
        COALESCE(pd.pending_production, 0)
      ) AS suggested_quantity,
      -- Determine urgency
      CASE 
        WHEN COALESCE(stock.current_stock, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (COALESCE(stock.current_stock, 0)::numeric / (COALESCE(sd.sales_30d, 0)::numeric / 30)) < 7 THEN 'high'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (COALESCE(stock.current_stock, 0)::numeric / (COALESCE(sd.sales_30d, 0)::numeric / 30)) < 14 THEN 'medium'
        ELSE 'low'
      END AS urgency,
      -- Generate reason
      CASE 
        WHEN COALESCE(stock.current_stock, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 
        THEN 'Sin inventario - producto con ventas activas'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (COALESCE(stock.current_stock, 0)::numeric / (COALESCE(sd.sales_30d, 0)::numeric / 30)) < 7 
        THEN 'Inventario crítico - menos de 1 semana de stock'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (COALESCE(stock.current_stock, 0)::numeric / (COALESCE(sd.sales_30d, 0)::numeric / 30)) < 14 
        THEN 'Inventario bajo - menos de 2 semanas de stock'
        WHEN COALESCE(sd.sales_30d, 0) = 0 
        THEN 'Sin ventas recientes'
        ELSE 'Nivel de inventario adecuado'
      END AS reason,
      -- Data confidence
      CASE 
        WHEN COALESCE(sd.orders_count_30d, 0) >= 10 THEN 'high'
        WHEN COALESCE(sd.orders_count_30d, 0) >= 3 THEN 'medium'
        ELSE 'low'
      END AS data_confidence
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sd ON pv.id = sd.product_variant_id
    LEFT JOIN stock_data stock ON pv.id = stock.product_variant_id
    LEFT JOIN pending_data pd ON pv.id = pd.product_variant_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
  )
  -- Insert or update inventory_replenishment records
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
    variant_id,
    CURRENT_DATE,
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
    'pending'
  FROM combined_data
  WHERE suggested_quantity > 0 OR urgency IN ('critical', 'high')
  ON CONFLICT (organization_id, variant_id, calculation_date) 
  DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    pending_production = EXCLUDED.pending_production,
    sales_30d = EXCLUDED.sales_30d,
    orders_count_30d = EXCLUDED.orders_count_30d,
    avg_daily_sales = EXCLUDED.avg_daily_sales,
    days_of_supply = EXCLUDED.days_of_supply,
    projected_demand_40d = EXCLUDED.projected_demand_40d,
    suggested_quantity = EXCLUDED.suggested_quantity,
    urgency = EXCLUDED.urgency,
    reason = EXCLUDED.reason,
    data_confidence = EXCLUDED.data_confidence,
    calculated_at = now();

  GET DIAGNOSTICS result_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', result_count,
    'calculation_date', CURRENT_DATE
  );
END;
$$;

-- Recreate the view for replenishment details
CREATE OR REPLACE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.variant_id,
  ir.organization_id,
  ir.calculation_date,
  ir.current_stock,
  ir.pending_production,
  ir.sales_30d,
  ir.orders_count_30d,
  ir.avg_daily_sales,
  ir.days_of_supply,
  ir.projected_demand_40d,
  ir.suggested_quantity,
  ir.urgency,
  ir.reason,
  ir.data_confidence,
  ir.status,
  ir.calculated_at,
  p.name AS product_name,
  p.sku,
  pv.sku_variant,
  pv.size AS variant_size,
  pv.color AS variant_color
FROM inventory_replenishment ir
JOIN product_variants pv ON ir.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE ir.calculation_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY 
  CASE ir.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  ir.suggested_quantity DESC;