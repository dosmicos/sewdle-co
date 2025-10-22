-- Cambiar cálculos de ventas de 60 días a 30 días

-- 1. Renombrar columnas en inventory_replenishment
ALTER TABLE inventory_replenishment 
  RENAME COLUMN sales_60d TO sales_30d;

ALTER TABLE inventory_replenishment 
  RENAME COLUMN orders_count_60d TO orders_count_30d;

-- 2. Actualizar función refresh_inventory_replenishment para usar 30 días
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
  result jsonb;
BEGIN
  -- Limpiar cálculos del día actual
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;
  
  -- Calcular nuevas sugerencias basadas en datos reales de últimos 30 días
  WITH shopify_sales AS (
    SELECT 
      pv.id as variant_id,
      COUNT(DISTINCT so.shopify_order_id) as order_count,
      COALESCE(SUM(soli.quantity), 0)::integer as total_sold
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid')
      AND so.cancelled_at IS NULL
      AND so.organization_id = org_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
    GROUP BY pv.id
  ),
  production_pending AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as pending_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_progress')
    GROUP BY oi.product_variant_id
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
    calculation_date
  )
  SELECT 
    org_id,
    pv.id,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    COALESCE(ss.total_sold, 0),
    COALESCE(ss.order_count, 0),
    ROUND(COALESCE(ss.total_sold, 0)::numeric / 30.0, 2),
    -- Days of supply
    CASE 
      WHEN COALESCE(ss.total_sold, 0) > 0 
      THEN ROUND(COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0), 1)
      ELSE NULL
    END,
    -- Projected 30-day demand (ahora es 1:1 con total_sold)
    COALESCE(ss.total_sold, 0),
    -- Suggested quantity
    GREATEST(0, COALESCE(ss.total_sold, 0) - COALESCE(pv.stock_quantity, 0)),
    -- Urgency level
    CASE
      WHEN COALESCE(ss.total_sold, 0) = 0 THEN 'low'
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND ss.total_sold > 0 THEN 'critical'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 7 THEN 'critical'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 15 THEN 'high'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 30 THEN 'medium'
      ELSE 'low'
    END,
    -- Detailed reason
    CASE
      WHEN COALESCE(ss.total_sold, 0) = 0 THEN 
        'Sin ventas en Shopify en últimos 30 días'
      WHEN COALESCE(pv.stock_quantity, 0) = 0 THEN 
        'Stock agotado - Reposición urgente (Velocidad: ' || 
        ROUND(ss.total_sold::numeric / 30.0, 2)::text || ' uds/día en Shopify)'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 7 THEN 
        'Stock crítico - Menos de 7 días disponibles (Velocidad Shopify: ' || 
        ROUND(ss.total_sold::numeric / 30.0, 2)::text || ' uds/día, ' || 
        ss.order_count::text || ' pedidos en 30d)'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 15 THEN 
        'Stock bajo - Menos de 15 días disponibles (Velocidad Shopify: ' || 
        ROUND(ss.total_sold::numeric / 30.0, 2)::text || ' uds/día, ' || 
        ss.order_count::text || ' pedidos en 30d)'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 30.0) < 30 THEN 
        'Reposición recomendada (Velocidad Shopify: ' || 
        ROUND(ss.total_sold::numeric / 30.0, 2)::text || ' uds/día, ' || 
        ss.order_count::text || ' pedidos en 30d)'
      ELSE 
        'Stock adecuado para demanda actual de Shopify'
    END,
    CURRENT_DATE,
    -- Data quality based on number of orders
    CASE 
      WHEN ss.order_count >= 5 THEN 'high'
      WHEN ss.order_count >= 2 THEN 'medium'
      ELSE 'low'
    END
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN shopify_sales ss ON pv.id = ss.variant_id
  LEFT JOIN production_pending pp ON pv.id = pp.product_variant_id
  WHERE p.organization_id = org_id
    AND p.status = 'active'
    AND (ss.total_sold > 0 OR pv.stock_quantity > 0);

  -- Count inserted records
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count
  );
END;
$$;

-- 3. Recrear vista v_replenishment_details con nuevos nombres de columnas
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
  ir.sales_30d,
  ir.orders_count_30d,
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