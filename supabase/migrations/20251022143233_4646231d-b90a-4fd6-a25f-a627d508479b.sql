-- Drop and recreate v_replenishment_details view to include calculation_date column
DROP VIEW IF EXISTS v_replenishment_details;

CREATE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.organization_id,
  ir.variant_id,
  p.name as product_name,
  p.sku,
  pv.sku_variant,
  pv.size as variant_size,
  pv.color as variant_color,
  ir.current_stock,
  ir.pending_production,
  ir.sales_60d,
  ir.orders_count_60d,
  ir.avg_daily_sales,
  ir.days_of_supply,
  ir.projected_30d_demand,
  ir.suggested_quantity,
  ir.urgency,
  ir.reason,
  ir.data_confidence,
  ir.calculated_at,
  ir.calculation_date,
  ir.status
FROM inventory_replenishment ir
INNER JOIN product_variants pv ON ir.variant_id = pv.id
INNER JOIN products p ON pv.product_id = p.id
WHERE ir.calculation_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY 
  CASE ir.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  ir.suggested_quantity DESC;