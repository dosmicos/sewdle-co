-- Update calculate_replenishment_suggestions to use 60 days instead of 90 days
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders integer,
  projected_demand numeric,
  suggested_quantity integer,
  urgency_level text,
  reason text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Calculate replenishment suggestions based on 60-day sales velocity
  RETURN QUERY
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
  SELECT 
    inv.variant_id,
    inv.product_name,
    inv.variant_size,
    inv.variant_color,
    inv.sku_variant,
    inv.current_stock,
    ROUND(inv.total_sold_60d / 60.0, 2) as sales_velocity,
    CASE 
      WHEN inv.total_sold_60d > 0 THEN ROUND(inv.current_stock / (inv.total_sold_60d / 60.0), 1)
      ELSE 999.9
    END as days_of_stock,
    COALESCE(oo.pending_quantity, 0)::integer as open_orders,
    ROUND((inv.total_sold_60d / 60.0) * 30, 0) as projected_demand,
    CASE
      WHEN inv.total_sold_60d > 0 THEN
        GREATEST(0, ROUND((inv.total_sold_60d / 60.0) * 30 - inv.current_stock, 0))::integer
      ELSE 0
    END as suggested_quantity,
    CASE
      WHEN inv.total_sold_60d = 0 THEN 'low'
      WHEN inv.current_stock = 0 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 'high'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 30 THEN 'normal'
      ELSE 'low'
    END as urgency_level,
    CASE
      WHEN inv.total_sold_60d = 0 THEN 'Sin ventas en últimos 60 días'
      WHEN inv.current_stock = 0 THEN 'Stock agotado - Reposición urgente'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 
        'Stock crítico - Menos de 7 días disponibles (Velocidad: ' || ROUND(inv.total_sold_60d / 60.0, 2)::text || ' unidades/día)'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 
        'Stock bajo - Menos de 15 días disponibles (Velocidad: ' || ROUND(inv.total_sold_60d / 60.0, 2)::text || ' unidades/día)'
      ELSE 'Stock adecuado'
    END as reason
  FROM inventory_data inv
  LEFT JOIN open_orders_data oo ON inv.variant_id = oo.variant_id
  WHERE inv.total_sold_60d > 0 OR inv.current_stock > 0
  ORDER BY 
    CASE 
      WHEN inv.current_stock = 0 THEN 1
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 2
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 3
      ELSE 4
    END,
    inv.total_sold_60d DESC;
END;
$$;