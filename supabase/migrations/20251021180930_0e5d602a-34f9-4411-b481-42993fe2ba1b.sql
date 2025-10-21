-- Fix calculation_date ambiguity in calculate_replenishment_suggestions
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS TABLE (
  records_inserted integer,
  calculation_date date
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_records_inserted INTEGER := 0;
BEGIN
  -- 1. Delete old suggestions from current day
  DELETE FROM replenishment_suggestions
  WHERE replenishment_suggestions.organization_id = p_organization_id
    AND replenishment_suggestions.calculation_date = CURRENT_DATE;

  -- 2. Insert new calculated suggestions
  WITH sales_data AS (
    SELECT 
      oi.variant_id,
      COALESCE(SUM(oi.quantity), 0) as total_sold
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = p_organization_id
      AND o.created_at >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY oi.variant_id
  ),
  inventory_data AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(pv.stock, 0) as current_stock,
      COALESCE(sales.total_sold, 0) as total_sold_60d
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sales ON pv.id = sales.variant_id
    WHERE p.organization_id = p_organization_id
      AND p.active = true
  ),
  open_orders_data AS (
    SELECT 
      oi.variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_quantity
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY oi.variant_id
  )
  INSERT INTO replenishment_suggestions (
    product_variant_id,
    organization_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason,
    calculation_date,
    status,
    data_quality
  )
  SELECT 
    inv.variant_id,
    p_organization_id,
    inv.current_stock,
    ROUND(inv.total_sold_60d / 60.0, 2),
    CASE 
      WHEN inv.total_sold_60d > 0 THEN ROUND(inv.current_stock / (inv.total_sold_60d / 60.0), 1)
      ELSE 999.9
    END,
    COALESCE(oo.pending_quantity, 0)::integer,
    ROUND((inv.total_sold_60d / 60.0) * 30, 0),
    CASE
      WHEN inv.total_sold_60d > 0 THEN
        GREATEST(0, ROUND((inv.total_sold_60d / 60.0) * 30 - inv.current_stock, 0))::integer
      ELSE 0
    END,
    CASE
      WHEN inv.total_sold_60d = 0 THEN 'low'
      WHEN inv.current_stock = 0 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 'high'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 30 THEN 'normal'
      ELSE 'low'
    END,
    CASE
      WHEN inv.total_sold_60d = 0 THEN 'Sin ventas en últimos 60 días'
      WHEN inv.current_stock = 0 THEN 'Stock agotado - Reposición urgente'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 
        'Stock crítico - Menos de 7 días disponibles (Velocidad: ' || ROUND(inv.total_sold_60d / 60.0, 2)::text || ' unidades/día)'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 
        'Stock bajo - Menos de 15 días disponibles (Velocidad: ' || ROUND(inv.total_sold_60d / 60.0, 2)::text || ' unidades/día)'
      ELSE 'Stock adecuado'
    END,
    CURRENT_DATE,
    'pending',
    'medium'
  FROM inventory_data inv
  LEFT JOIN open_orders_data oo ON inv.variant_id = oo.variant_id
  WHERE inv.total_sold_60d > 0 OR inv.current_stock > 0;

  -- 3. Count inserted records
  GET DIAGNOSTICS v_records_inserted = ROW_COUNT;

  -- 4. Return result
  RETURN QUERY SELECT v_records_inserted, CURRENT_DATE;
END;
$$;