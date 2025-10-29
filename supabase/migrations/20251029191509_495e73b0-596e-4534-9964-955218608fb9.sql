-- Fix refresh_inventory_replenishment function to use correct table name
CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rows_inserted INTEGER := 0;
BEGIN
  -- Limpiar datos antiguos de la organización (más de 7 días)
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date < CURRENT_DATE - INTERVAL '7 days';

  -- Insertar nuevos cálculos de reposición usando proyección a 40 días
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
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
    calculation_date
  )
  SELECT 
    org_id,
    pv.id AS variant_id,
    COALESCE(pv.stock_quantity, 0) AS current_stock,
    COALESCE(pending.total_pending, 0) AS pending_production,
    COALESCE(sales.total_sales_30d, 0) AS sales_30d,
    COALESCE(sales.orders_count_30d, 0) AS orders_count_30d,
    COALESCE(sales.total_sales_30d / 30.0, 0) AS avg_daily_sales,
    CASE 
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
      THEN COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0)
      ELSE 999
    END AS days_of_supply,
    -- Proyección a 40 días basada en ventas de últimos 30 días
    ROUND(COALESCE(sales.total_sales_30d / 30.0, 0) * 40) AS projected_demand_40d,
    -- Cantidad sugerida: proyección 40 días - (stock actual + producción pendiente)
    GREATEST(0, 
      ROUND(COALESCE(sales.total_sales_30d / 30.0, 0) * 40) - 
      (COALESCE(pv.stock_quantity, 0) + COALESCE(pending.total_pending, 0))
    ) AS suggested_quantity,
    CASE
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
           AND COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0) < 7 
      THEN 'critical'
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
           AND COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0) < 15 
      THEN 'high'
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
           AND COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0) < 30 
      THEN 'medium'
      ELSE 'low'
    END AS urgency,
    CASE
      WHEN COALESCE(sales.orders_count_30d, 0) = 0 THEN 'Sin ventas recientes'
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
           AND COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0) < 7 
      THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN COALESCE(sales.total_sales_30d / 30.0, 0) > 0 
           AND COALESCE(pv.stock_quantity, 0) / (sales.total_sales_30d / 30.0) < 15 
      THEN 'Stock bajo: menos de 15 días de inventario'
      ELSE 'Reposición preventiva recomendada'
    END AS reason,
    CASE
      WHEN COALESCE(sales.orders_count_30d, 0) >= 5 THEN 'high'
      WHEN COALESCE(sales.orders_count_30d, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END AS data_confidence,
    CURRENT_DATE AS calculation_date
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT 
      SUM(oi.quantity) AS total_sales_30d,
      COUNT(DISTINCT o.id) AS orders_count_30d
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = pv.id
      AND o.organization_id = org_id
      AND o.order_date >= CURRENT_DATE - INTERVAL '30 days'
      AND o.status NOT IN ('cancelled', 'rejected')
  ) sales ON true
  LEFT JOIN LATERAL (
    SELECT 
      SUM(oi.quantity - COALESCE(delivered.total_delivered, 0)) AS total_pending
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN LATERAL (
      SELECT SUM(di.quantity_delivered) AS total_delivered
      FROM delivery_items di
      JOIN deliveries d ON di.delivery_id = d.id
      WHERE di.order_item_id = oi.id
        AND d.status = 'approved'
    ) delivered ON true
    WHERE oi.product_variant_id = pv.id
      AND o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress', 'assigned')
  ) pending ON true
  WHERE p.organization_id = org_id
    AND COALESCE(sales.total_sales_30d, 0) > 0;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', rows_inserted,
    'organization_id', org_id,
    'calculation_date', CURRENT_DATE
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'organization_id', org_id
    );
END;
$$;