-- Modificar cálculo de días de stock para usar solo stock actual (sin pendientes)
DROP VIEW IF EXISTS v_replenishment_details CASCADE;

-- Recrear función refresh_inventory_replenishment con nuevo cálculo
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_inserted INTEGER := 0;
  calculation_date DATE := CURRENT_DATE;
BEGIN
  -- Insertar nuevos registros calculados
  WITH sales_data AS (
    SELECT 
      soi.product_variant_id,
      COUNT(DISTINCT so.id) AS orders_count_30d,
      SUM(soi.quantity) AS sales_30d
    FROM shopify_orders so
    JOIN shopify_order_items soi ON so.id = soi.shopify_order_id
    WHERE so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'authorized')
      AND so.cancelled_at IS NULL
    GROUP BY soi.product_variant_id
  ),
  pending_production_data AS (
    SELECT 
      oi.product_variant_id,
      SUM(oi.quantity - COALESCE(di_summary.delivered, 0)) AS pending_units
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN (
      SELECT 
        di.order_item_id,
        SUM(di.quantity_delivered) AS delivered
      FROM delivery_items di
      JOIN deliveries d ON di.delivery_id = d.id
      WHERE d.status IN ('approved', 'delivered')
      GROUP BY di.order_item_id
    ) di_summary ON oi.id = di_summary.order_item_id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production', 'assigned')
    GROUP BY oi.product_variant_id
  )
  INSERT INTO inventory_replenishment (
    variant_id,
    organization_id,
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
    calculated_at,
    calculation_date,
    status
  )
  SELECT 
    pv.id AS variant_id,
    org_id AS organization_id,
    COALESCE(pv.stock_quantity, 0) AS current_stock,
    COALESCE(ppd.pending_units, 0) AS pending_production,
    COALESCE(sd.sales_30d, 0) AS sales_30d,
    COALESCE(sd.orders_count_30d, 0) AS orders_count_30d,
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0, 2) AS avg_daily_sales,
    -- CAMBIO: Usar solo stock actual sin pendientes
    CASE 
      WHEN COALESCE(sd.sales_30d, 0) = 0 THEN NULL
      ELSE ROUND(COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.sales_30d, 0) / 30.0), 1)
    END AS days_of_supply,
    ROUND(COALESCE(sd.sales_30d, 0) * 1.33, 0) AS projected_demand_40d,
    GREATEST(0, ROUND(COALESCE(sd.sales_30d, 0) * 1.33, 0) - COALESCE(pv.stock_quantity, 0) - COALESCE(ppd.pending_units, 0)) AS suggested_quantity,
    -- CAMBIO: Ajustar urgencia para usar solo stock actual
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
      WHEN COALESCE(sd.sales_30d, 0) = 0 THEN NULL
      WHEN COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.sales_30d, 0) / 30.0) < 7 THEN 'high'
      WHEN COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.sales_30d, 0) / 30.0) < 14 THEN 'medium'
      ELSE 'low'
    END AS urgency,
    CASE
      WHEN COALESCE(sd.sales_30d, 0) = 0 THEN 'Sin ventas recientes'
      WHEN COALESCE(pv.stock_quantity, 0) <= 0 THEN 'Stock agotado con demanda activa'
      WHEN COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.sales_30d, 0) / 30.0) < 7 THEN 'Stock bajo - menos de 1 semana'
      WHEN COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.sales_30d, 0) / 30.0) < 14 THEN 'Stock medio - menos de 2 semanas'
      ELSE 'Stock suficiente'
    END AS reason,
    CASE
      WHEN COALESCE(sd.orders_count_30d, 0) >= 5 THEN 'high'
      WHEN COALESCE(sd.orders_count_30d, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END AS data_confidence,
    NOW() AS calculated_at,
    calculation_date,
    'pending' AS status
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_data sd ON pv.id = sd.product_variant_id
  LEFT JOIN pending_production_data ppd ON pv.id = ppd.product_variant_id
  WHERE p.organization_id = org_id
    AND (COALESCE(sd.sales_30d, 0) > 0 OR COALESCE(pv.stock_quantity, 0) > 0);

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', rows_inserted
  );
END;
$$;

-- Recrear vista v_replenishment_details
CREATE OR REPLACE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.variant_id,
  ir.organization_id,
  p.name AS product_name,
  p.sku,
  pv.sku_variant,
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
  ir.status,
  ir.calculation_date
FROM inventory_replenishment ir
JOIN product_variants pv ON ir.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;