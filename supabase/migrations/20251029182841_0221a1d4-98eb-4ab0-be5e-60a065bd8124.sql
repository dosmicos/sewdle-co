-- Corregir cálculo de pendientes (restar entregas aprobadas)
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Eliminar cálculos antiguos del día actual
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- CTE para calcular ventas de los últimos 30 días
  WITH sales_30d AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_qty,
      COUNT(DISTINCT soli.shopify_order_id) as orders_count_30d
    FROM product_variants pv
    LEFT JOIN shopify_order_line_items soli ON pv.sku_variant = soli.sku
      AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'
    INNER JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.financial_status IN ('paid', 'partially_paid')
    WHERE pv.product_id IN (
      SELECT id FROM products WHERE organization_id = org_id
    )
    GROUP BY pv.id
  ),
  
  -- CTE para calcular producción pendiente (CORREGIDO: resta entregas aprobadas)
  pending_production AS (
    SELECT 
      oi.product_variant_id,
      GREATEST(0, 
        COALESCE(SUM(oi.quantity), 0) - 
        COALESCE(SUM(di.quantity_approved), 0)
      ) as pending_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    LEFT JOIN delivery_items di ON oi.id = di.order_item_id
    LEFT JOIN deliveries d ON di.delivery_id = d.id 
      AND d.status = 'approved'
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY oi.product_variant_id
  )

  -- Insertar nuevos cálculos
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
    projected_30d_demand,
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
    COALESCE(s.sales_qty, 0),
    COALESCE(s.orders_count_30d, 0),
    COALESCE(s.sales_qty, 0) / 30.0,
    -- Stock actual / velocidad diaria
    CASE 
      WHEN COALESCE(s.sales_qty, 0) = 0 THEN NULL
      ELSE COALESCE(pv.stock_quantity, 0) / (COALESCE(s.sales_qty, 0) / 30.0)
    END,
    COALESCE(s.sales_qty, 0),
    GREATEST(0, COALESCE(s.sales_qty, 0) - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.pending_qty, 0)),
    -- Urgencia basada en stock actual
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 7 THEN 'critical'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 14 THEN 'high'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 30 THEN 'medium'
      ELSE 'low'
    END,
    -- Razón basada en stock actual
    CASE
      WHEN COALESCE(s.sales_qty, 0) = 0 THEN 'No hay ventas registradas en los últimos 30 días'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 7 THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 14 THEN 'Stock bajo: menos de 14 días de inventario'
      ELSE 'Stock adecuado'
    END,
    CASE
      WHEN COALESCE(s.orders_count_30d, 0) >= 10 THEN 'high'
      WHEN COALESCE(s.orders_count_30d, 0) >= 3 THEN 'medium'
      ELSE 'low'
    END,
    'pending'
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_30d s ON pv.id = s.variant_id
  LEFT JOIN pending_production pp ON pv.id = pp.product_variant_id
  WHERE p.organization_id = org_id
    AND COALESCE(s.sales_qty, 0) > 0;

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