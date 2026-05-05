-- Corrección definitiva: CTEs separados para evitar duplicación
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
  
  -- CTE para calcular cantidades ordenadas (sin JOIN a delivery_items)
  ordered_by_variant AS (
    SELECT 
      oi.product_variant_id,
      SUM(oi.quantity) as total_ordered
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress', 'assigned')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE para calcular cantidades aprobadas (independiente)
  approved_by_variant AS (
    SELECT 
      oi.product_variant_id,
      SUM(di.quantity_approved) as total_approved
    FROM delivery_items di
    INNER JOIN order_items oi ON di.order_item_id = oi.id
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress', 'assigned')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE para calcular producción pendiente (combinar ordenado - aprobado)
  pending_production AS (
    SELECT 
      ov.product_variant_id,
      GREATEST(0, 
        COALESCE(ov.total_ordered, 0) - 
        COALESCE(av.total_approved, 0)
      ) as pending_qty
    FROM ordered_by_variant ov
    LEFT JOIN approved_by_variant av ON ov.product_variant_id = av.product_variant_id
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
    CASE 
      WHEN COALESCE(s.sales_qty, 0) = 0 THEN NULL
      ELSE COALESCE(pv.stock_quantity, 0) / (COALESCE(s.sales_qty, 0) / 30.0)
    END,
    COALESCE(s.sales_qty, 0),
    GREATEST(0, COALESCE(s.sales_qty, 0) - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.pending_qty, 0)),
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 7 THEN 'critical'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 14 THEN 'high'
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF((COALESCE(s.sales_qty, 0) / 30.0), 0) < 30 THEN 'medium'
      ELSE 'low'
    END,
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