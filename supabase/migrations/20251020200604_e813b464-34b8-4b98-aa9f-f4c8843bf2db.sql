-- Drop and recreate the calculate_replenishment_suggestions function with format() fixes
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days_of_stock integer := 30;
  v_critical_threshold integer := 7;
  v_low_threshold integer := 14;
BEGIN
  -- Delete existing suggestions for this organization
  DELETE FROM replenishment_suggestions
  WHERE organization_id = p_organization_id;

  -- Calculate sales data per variant
  WITH sales_data AS (
    SELECT 
      oi.product_variant_id,
      SUM(oi.quantity) as total_sold,
      COUNT(DISTINCT o.id) as order_count,
      MAX(o.order_date) as last_sale_date
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.organization_id = p_organization_id
      AND o.order_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY oi.product_variant_id
  ),
  -- Get open orders per variant
  open_orders AS (
    SELECT 
      oi.product_variant_id,
      SUM(oi.quantity) as pending_quantity
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'in_production')
    GROUP BY oi.product_variant_id
  ),
  -- Calculate suggested quantities
  calculations AS (
    SELECT 
      pv.id as product_variant_id,
      p.id as product_id,
      p.name as product_name,
      pv.size,
      pv.color,
      COALESCE(pv.stock_quantity, 0) as current_stock,
      COALESCE(sd.total_sold, 0) as units_sold_90_days,
      COALESCE(oo.pending_quantity, 0) as pending_orders,
      COALESCE(sd.total_sold / 90.0, 0) as daily_velocity,
      GREATEST(
        CEIL((COALESCE(sd.total_sold / 90.0, 0) * v_days_of_stock) - COALESCE(pv.stock_quantity, 0) - COALESCE(oo.pending_quantity, 0)),
        0
      ) as suggested_quantity,
      CASE 
        WHEN COALESCE(sd.total_sold, 0) > 0 AND COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0) < v_critical_threshold 
          THEN 'Stock crítico: solo ' || ROUND(COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0), 1)::text || ' días de inventario restante'
        WHEN COALESCE(sd.total_sold, 0) > 0 AND COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0) < v_low_threshold 
          THEN 'Stock bajo: ' || ROUND(COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0), 1)::text || ' días de inventario restante'
        WHEN COALESCE(sd.total_sold, 0) = 0 
          THEN 'Producto sin ventas en los últimos 90 días'
        ELSE 'Stock adecuado para ' || ROUND(COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0), 1)::text || ' días'
      END as reason,
      CASE 
        WHEN COALESCE(sd.total_sold, 0) > 0 AND COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0) < v_critical_threshold THEN 'critical'
        WHEN COALESCE(sd.total_sold, 0) > 0 AND COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0) < v_low_threshold THEN 'high'
        WHEN COALESCE(sd.total_sold, 0) > 0 THEN 'medium'
        ELSE 'low'
      END as urgency,
      sd.last_sale_date,
      rc.id as config_id
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN sales_data sd ON sd.product_variant_id = pv.id
    LEFT JOIN open_orders oo ON oo.product_variant_id = pv.id
    LEFT JOIN replenishment_config rc ON rc.product_id = p.id 
      AND rc.organization_id = p_organization_id 
      AND rc.is_active = true
    WHERE p.organization_id = p_organization_id
      AND pv.is_active = true
  )
  -- Insert suggestions where there's actual need
  INSERT INTO replenishment_suggestions (
    organization_id,
    product_variant_id,
    product_id,
    product_name,
    variant_size,
    variant_color,
    current_stock,
    suggested_quantity,
    daily_velocity,
    units_sold_90_days,
    pending_orders,
    urgency,
    reason,
    last_sale_date,
    config_id
  )
  SELECT 
    p_organization_id,
    c.product_variant_id,
    c.product_id,
    c.product_name,
    c.size,
    c.color,
    c.current_stock,
    c.suggested_quantity,
    c.daily_velocity,
    c.units_sold_90_days,
    c.pending_orders,
    c.urgency,
    c.reason,
    c.last_sale_date,
    c.config_id
  FROM calculations c
  WHERE c.suggested_quantity > 0 
     OR c.urgency IN ('critical', 'high');

END;
$$;