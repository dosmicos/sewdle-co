-- Drop and recreate v_replenishment_details view to use projected_demand_40d
DROP VIEW IF EXISTS v_replenishment_details;

CREATE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.organization_id,
  ir.variant_id,
  p.name AS product_name,
  p.sku,
  p.sku AS sku_variant,
  pv.size AS variant_size,
  pv.color AS variant_color,
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
  ir.calculated_at,
  ir.calculation_date,
  ir.status
FROM inventory_replenishment ir
JOIN product_variants pv ON ir.variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE ir.status = 'pending'
ORDER BY 
  CASE ir.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  ir.suggested_quantity DESC;