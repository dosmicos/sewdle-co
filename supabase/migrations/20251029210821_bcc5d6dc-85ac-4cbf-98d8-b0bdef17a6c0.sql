-- Corrección de tipos de datos en refresh_inventory_replenishment
-- Línea 22: COUNT(DISTINCT so.shopify_order_id) en lugar de so.id
-- Línea 25: JOIN usando shopify_order_id (BIGINT) en ambos lados

DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Eliminar cálculos anteriores del día actual
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
  AND calculation_date = CURRENT_DATE;

  -- CTE para obtener datos de ventas de Shopify de los últimos 30 días
  WITH sales_data AS (
    SELECT 
      pv.id AS product_variant_id,
      COUNT(DISTINCT so.shopify_order_id) AS orders_count_30d,
      SUM(soi.quantity) AS sales_30d
    FROM shopify_orders so
    JOIN shopify_order_line_items soi ON so.shopify_order_id = soi.shopify_order_id
    JOIN product_variants pv ON soi.sku = pv.sku_variant
    WHERE so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'authorized')
      AND so.cancelled_at IS NULL
    GROUP BY pv.id
  ),
  
  -- CTE para calcular producción pendiente por variante
  pending_production AS (
    SELECT 
      oi.product_variant_id,
      SUM(oi.quantity - COALESCE(di.quantity_approved, 0)) AS pending_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN delivery_items di ON oi.id = di.order_item_id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production', 'assigned')
    GROUP BY oi.product_variant_id
  )
  
  -- Insertar cálculos de reposición
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
    pv.id,
    CURRENT_DATE,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    COALESCE(sd.sales_30d, 0),
    COALESCE(sd.orders_count_30d, 0),
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0, 2),
    CASE 
      WHEN COALESCE(sd.sales_30d, 0) = 0 THEN NULL
      ELSE ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(sd.sales_30d, 0) / 30.0), 1)
    END,
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0 * 40, 0),
    GREATEST(0, ROUND(COALESCE(sd.sales_30d, 0) / 30.0 * 40 - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.pending_qty, 0), 0)),
    CASE 
      WHEN COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0) <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 10 THEN 'high'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 20 THEN 'medium'
      ELSE 'low'
    END,
    CASE 
      WHEN COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0) <= 0 AND COALESCE(sd.sales_30d, 0) > 0 
        THEN 'Sin stock disponible con demanda activa'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 10 
        THEN 'Menos de 10 días de inventario'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(sd.sales_30d, 0) / 30.0, 0) < 20 
        THEN 'Menos de 20 días de inventario'
      ELSE 'Stock adecuado para demanda proyectada'
    END,
    CASE 
      WHEN COALESCE(sd.orders_count_30d, 0) >= 10 THEN 'high'
      WHEN COALESCE(sd.orders_count_30d, 0) >= 3 THEN 'medium'
      ELSE 'low'
    END,
    'pending'
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_data sd ON pv.id = sd.product_variant_id
  LEFT JOIN pending_production pp ON pv.id = pp.product_variant_id
  WHERE p.organization_id = org_id
    AND p.status = 'active'
    AND COALESCE(sd.sales_30d, 0) > 0;
  
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
      'error_code', SQLSTATE
    );
END;
$$;