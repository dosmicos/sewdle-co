-- Actualizar función de cálculo de reposición con proyección a 40 días
CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Limpiar cálculos anteriores del día actual
  DELETE FROM replenishment_suggestions 
  WHERE organization_id = org_id 
  AND calculation_date = CURRENT_DATE;

  -- CTE para ventas de últimos 30 días por variante
  WITH sales_30d AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(sm.quantity_sold), 0) as sales_qty,
      COUNT(DISTINCT sm.order_date) as days_with_sales,
      COUNT(DISTINCT so.id) as orders_count
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_metrics sm ON pv.id = sm.product_variant_id
      AND sm.order_date >= CURRENT_DATE - INTERVAL '30 days'
      AND sm.organization_id = org_id
    LEFT JOIN shopify_orders so ON sm.shopify_order_id = so.id
      AND so.organization_id = org_id
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  
  -- CTE para cantidades ordenadas por variante
  ordered_by_variant AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0) as ordered_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_production')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE para cantidades aprobadas por variante
  approved_by_variant AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(di.quantity_approved), 0) as approved_qty
    FROM delivery_items di
    JOIN order_items oi ON di.order_item_id = oi.id
    JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.organization_id = org_id
      AND d.status IN ('approved', 'in_quality')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE para producción pendiente (ordenado - aprobado)
  pending_production AS (
    SELECT 
      COALESCE(o.product_variant_id, a.product_variant_id) as variant_id,
      GREATEST(0, COALESCE(o.ordered_qty, 0) - COALESCE(a.approved_qty, 0)) as pending_qty
    FROM ordered_by_variant o
    FULL OUTER JOIN approved_by_variant a 
      ON o.product_variant_id = a.product_variant_id
  )

  -- Insertar sugerencias de reposición
  INSERT INTO replenishment_suggestions (
    organization_id,
    product_variant_id,
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
    data_confidence
  )
  SELECT 
    org_id,
    pv.id,
    CURRENT_DATE,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    COALESCE(s.sales_qty, 0),
    COALESCE(s.orders_count, 0),
    ROUND(COALESCE(s.sales_qty, 0) / 30.0, 2) as avg_daily_sales,
    CASE 
      WHEN COALESCE(s.sales_qty, 0) > 0 
      THEN ROUND((COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / (COALESCE(s.sales_qty, 0) / 30.0), 1)
      ELSE 999.9
    END as days_of_supply,
    ROUND((COALESCE(s.sales_qty, 0) / 30.0) * 40, 0) as projected_demand_40d,
    -- Nueva fórmula: (velocidad diaria * 40) - stock - pendientes
    GREATEST(0, 
      ROUND((COALESCE(s.sales_qty, 0) / 30.0) * 40, 0) 
      - COALESCE(pv.stock_quantity, 0) 
      - COALESCE(pp.pending_qty, 0)
    ) as suggested_quantity,
    CASE
      WHEN COALESCE(s.sales_qty, 0) = 0 THEN 'low'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 7 THEN 'critical'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 14 THEN 'high'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    CASE
      WHEN COALESCE(s.sales_qty, 0) = 0 THEN 'Sin ventas en últimos 30 días'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 7 
        THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 14 
        THEN 'Stock bajo: menos de 14 días de inventario'
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.pending_qty, 0)) / NULLIF(COALESCE(s.sales_qty, 0) / 30.0, 0) < 30 
        THEN 'Reposición recomendada para mantener 40 días de stock'
      ELSE 'Stock suficiente para demanda proyectada'
    END as reason,
    CASE 
      WHEN COALESCE(s.orders_count, 0) >= 5 AND COALESCE(s.days_with_sales, 0) >= 10 THEN 'high'
      WHEN COALESCE(s.orders_count, 0) >= 2 AND COALESCE(s.days_with_sales, 0) >= 5 THEN 'medium'
      ELSE 'low'
    END as data_confidence
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_30d s ON pv.id = s.variant_id
  LEFT JOIN pending_production pp ON pv.id = pp.variant_id
  WHERE p.organization_id = org_id
    AND COALESCE(s.sales_qty, 0) > 0; -- Solo variantes con ventas

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
      'error', SQLERRM
    );
END;
$$;