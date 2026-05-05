-- Corregir referencias de order_date a created_at en calculate_replenishment_suggestions
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock numeric,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders integer,
  projected_demand numeric,
  suggested_quantity numeric,
  urgency_level text,
  reason text
) AS $$
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT 
      oi.variant_id,
      SUM(oi.quantity) as total_sold,
      COUNT(DISTINCT o.id) as order_count,
      MAX(o.created_at) as last_sale_date
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = p_organization_id
      AND o.created_at >= CURRENT_DATE - INTERVAL '90 days'
      AND o.status NOT IN ('cancelled', 'rejected')
    GROUP BY oi.variant_id
  ),
  inventory_data AS (
    SELECT 
      v.id as variant_id,
      p.name as product_name,
      v.size as variant_size,
      v.color as variant_color,
      v.sku_variant,
      COALESCE(SUM(i.quantity), 0) as current_stock
    FROM product_variants v
    JOIN products p ON v.product_id = p.id
    LEFT JOIN inventory i ON v.id = i.variant_id
    WHERE p.organization_id = p_organization_id
      AND v.active = true
    GROUP BY v.id, p.name, v.size, v.color, v.sku_variant
  ),
  open_orders_data AS (
    SELECT 
      oi.variant_id,
      COUNT(DISTINCT o.id) as open_order_count
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'in_progress', 'assigned')
    GROUP BY oi.variant_id
  )
  SELECT 
    inv.variant_id,
    inv.product_name,
    inv.variant_size,
    inv.variant_color,
    inv.sku_variant,
    inv.current_stock,
    COALESCE(ROUND(sales.total_sold / 90.0, 2), 0) as sales_velocity,
    CASE 
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
      THEN ROUND(inv.current_stock / (sales.total_sold / 90.0), 1)
      ELSE 999
    END as days_of_stock,
    COALESCE(oo.open_order_count, 0)::integer as open_orders,
    COALESCE(ROUND((sales.total_sold / 90.0) * 30, 0), 0) as projected_demand,
    CASE
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
      THEN GREATEST(0, ROUND((sales.total_sold / 90.0) * 30 - inv.current_stock + 10, 0))
      ELSE 0
    END as suggested_quantity,
    CASE
      WHEN inv.current_stock = 0 AND COALESCE(sales.total_sold, 0) > 0 THEN 'critical'
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
           AND inv.current_stock / (sales.total_sold / 90.0) < 7 THEN 'high'
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
           AND inv.current_stock / (sales.total_sold / 90.0) < 15 THEN 'normal'
      ELSE 'low'
    END as urgency_level,
    'Stock actual: ' || ROUND(inv.current_stock, 0)::text || 
    ' | Velocidad: ' || ROUND(COALESCE(sales.total_sold / 90.0, 0), 2)::text || 
    ' unidades/día | Días de stock: ' || 
    CASE 
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
      THEN ROUND(inv.current_stock / (sales.total_sold / 90.0), 1)::text
      ELSE '999'
    END as reason
  FROM inventory_data inv
  LEFT JOIN sales_data sales ON inv.variant_id = sales.variant_id
  LEFT JOIN open_orders_data oo ON inv.variant_id = oo.variant_id
  WHERE COALESCE(sales.total_sold, 0) > 0
  ORDER BY 
    CASE 
      WHEN inv.current_stock = 0 AND COALESCE(sales.total_sold, 0) > 0 THEN 1
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
           AND inv.current_stock / (sales.total_sold / 90.0) < 7 THEN 2
      WHEN COALESCE(sales.total_sold / 90.0, 0) > 0 
           AND inv.current_stock / (sales.total_sold / 90.0) < 15 THEN 3
      ELSE 4
    END,
    COALESCE(sales.total_sold / 90.0, 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;