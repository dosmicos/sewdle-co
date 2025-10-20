-- Recrear la función calculate_replenishment_suggestions() alineada con la estructura de la tabla
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions() CASCADE;

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions()
RETURNS TABLE(
  product_variant_id uuid,
  current_stock integer,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders_quantity integer,
  projected_demand numeric,
  suggested_quantity integer,
  urgency_level text,
  reason text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_calculation_date date := CURRENT_DATE;
  v_days_lookback integer := 30;
  v_min_days_data integer := 7;
  v_safety_stock_days integer := 7;
  v_lead_time_days integer := 5;
  v_total_variants integer := 0;
BEGIN
  -- Eliminar sugerencias antiguas (más de 7 días)
  DELETE FROM replenishment_suggestions 
  WHERE calculation_date < CURRENT_DATE - INTERVAL '7 days';
  
  -- Calcular y insertar nuevas sugerencias
  WITH sales_data AS (
    SELECT 
      pv.id as variant_id,
      pv.stock_quantity as current_stock,
      COUNT(DISTINCT psh.recorded_at::date) as days_with_stock_data,
      COALESCE(
        (pv.stock_quantity - MIN(psh.stock_quantity)) / 
        NULLIF(GREATEST(COUNT(DISTINCT psh.recorded_at::date), 1), 0),
        0
      ) as daily_sales_velocity
    FROM product_variants pv
    LEFT JOIN product_stock_history psh 
      ON pv.id = psh.product_variant_id 
      AND psh.recorded_at >= CURRENT_DATE - v_days_lookback
    INNER JOIN products p ON pv.product_id = p.id
    WHERE p.status = 'active'
      AND p.organization_id = get_current_organization_safe()
    GROUP BY pv.id, pv.stock_quantity
    HAVING COUNT(DISTINCT psh.recorded_at::date) >= v_min_days_data
  ),
  open_orders_calc AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0) as open_orders_total
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.status IN ('pending', 'in_progress')
      AND o.organization_id = get_current_organization_safe()
    GROUP BY oi.product_variant_id
  ),
  calculations AS (
    SELECT
      sd.variant_id,
      sd.current_stock::integer as current_stock,
      ROUND(sd.daily_sales_velocity, 2) as sales_velocity,
      CASE 
        WHEN sd.daily_sales_velocity > 0 
        THEN ROUND(sd.current_stock / sd.daily_sales_velocity, 1)
        ELSE 999
      END as days_of_stock,
      COALESCE(ooc.open_orders_total, 0)::integer as open_orders_qty,
      ROUND(sd.daily_sales_velocity * (v_safety_stock_days + v_lead_time_days), 0) as projected_demand,
      GREATEST(
        ROUND(
          (sd.daily_sales_velocity * (v_safety_stock_days + v_lead_time_days)) - 
          sd.current_stock - 
          COALESCE(ooc.open_orders_total, 0),
          0
        ),
        0
      )::integer as suggested_qty,
      CASE
        WHEN sd.current_stock <= 0 THEN 'critical'
        WHEN sd.daily_sales_velocity > 0 AND (sd.current_stock / sd.daily_sales_velocity) < 3 THEN 'high'
        WHEN sd.daily_sales_velocity > 0 AND (sd.current_stock / sd.daily_sales_velocity) < 7 THEN 'normal'
        ELSE 'low'
      END as urgency,
      CASE
        WHEN sd.current_stock <= 0 THEN 'Sin stock disponible'
        WHEN sd.daily_sales_velocity > 0 AND (sd.current_stock / sd.daily_sales_velocity) < 3 
          THEN 'Stock crítico: menos de 3 días de inventario'
        WHEN sd.daily_sales_velocity > 0 AND (sd.current_stock / sd.daily_sales_velocity) < 7 
          THEN 'Stock bajo: menos de 7 días de inventario'
        ELSE 'Stock adecuado'
      END as reason_text,
      CASE
        WHEN sd.days_with_stock_data >= 25 THEN 'high'
        WHEN sd.days_with_stock_data >= 15 THEN 'medium'
        ELSE 'low'
      END as data_quality,
      get_current_organization_safe() as org_id
    FROM sales_data sd
    LEFT JOIN open_orders_calc ooc ON sd.variant_id = ooc.product_variant_id
    WHERE sd.daily_sales_velocity > 0
  )
  INSERT INTO replenishment_suggestions (
    product_variant_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason,
    calculation_date,
    organization_id,
    status,
    data_quality
  )
  SELECT 
    variant_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_qty,
    projected_demand,
    suggested_qty,
    urgency,
    reason_text,
    v_calculation_date,
    org_id,
    'pending',
    data_quality
  FROM calculations
  WHERE suggested_qty > 0
  RETURNING 
    product_variant_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason
  INTO 
    product_variant_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason;
    
  RETURN;
END;
$$;