-- Drop the existing function
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions();

-- Recreate the function with organization_id parameter
CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  current_stock NUMERIC,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders NUMERIC,
  projected_demand NUMERIC,
  suggested_quantity NUMERIC,
  urgency TEXT,
  last_30_days_sales NUMERIC,
  last_7_days_sales NUMERIC
) AS $$
DECLARE
  v_organization_id UUID;
BEGIN
  -- If organization_id is provided, use it; otherwise try to get it from context
  v_organization_id := COALESCE(
    p_organization_id,
    get_current_organization_safe()
  );
  
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  -- Delete old suggestions for this organization
  DELETE FROM replenishment_suggestions 
  WHERE organization_id = v_organization_id;

  -- Calculate and insert new suggestions
  WITH calculations AS (
    SELECT 
      p.id as calc_product_id,
      COALESCE(inv.quantity, 0) as calc_current_stock,
      COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.organization_id = v_organization_id
           AND o.created_at >= NOW() - INTERVAL '30 days'
        ) / 30.0, 
        0
      ) as calc_sales_velocity,
      CASE 
        WHEN COALESCE(
          (SELECT SUM(oi.quantity) 
           FROM order_items oi 
           JOIN orders o ON oi.order_id = o.id 
           WHERE oi.product_id = p.id 
             AND o.organization_id = v_organization_id
             AND o.created_at >= NOW() - INTERVAL '30 days'
          ) / 30.0, 
          0
        ) > 0 
        THEN COALESCE(inv.quantity, 0) / (
          (SELECT SUM(oi.quantity) 
           FROM order_items oi 
           JOIN orders o ON oi.order_id = o.id 
           WHERE oi.product_id = p.id 
             AND o.organization_id = v_organization_id
             AND o.created_at >= NOW() - INTERVAL '30 days'
          ) / 30.0
        )
        ELSE 999
      END as calc_days_of_stock,
      COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.organization_id = v_organization_id
           AND o.status IN ('pending', 'in_progress')
        ), 
        0
      ) as calc_open_orders,
      COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.organization_id = v_organization_id
           AND o.created_at >= NOW() - INTERVAL '30 days'
        ) / 30.0, 
        0
      ) * 30 as calc_projected_demand,
      COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.organization_id = v_organization_id
           AND o.created_at >= NOW() - INTERVAL '30 days'
        ), 
        0
      ) as calc_last_30_days_sales,
      COALESCE(
        (SELECT SUM(oi.quantity) 
         FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.product_id = p.id 
           AND o.organization_id = v_organization_id
           AND o.created_at >= NOW() - INTERVAL '7 days'
        ), 
        0
      ) as calc_last_7_days_sales
    FROM products p
    LEFT JOIN material_inventory inv ON inv.material_id = p.id 
      AND inv.organization_id = v_organization_id
    WHERE p.organization_id = v_organization_id
  )
  INSERT INTO replenishment_suggestions (
    organization_id,
    product_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders,
    projected_demand,
    suggested_quantity,
    urgency,
    last_30_days_sales,
    last_7_days_sales
  )
  SELECT 
    v_organization_id,
    c.calc_product_id,
    c.calc_current_stock,
    c.calc_sales_velocity,
    c.calc_days_of_stock,
    c.calc_open_orders,
    c.calc_projected_demand,
    GREATEST(
      c.calc_projected_demand - c.calc_current_stock - c.calc_open_orders,
      0
    ) as suggested_quantity,
    CASE 
      WHEN c.calc_days_of_stock < 7 THEN 'urgent'
      WHEN c.calc_days_of_stock < 14 THEN 'high'
      WHEN c.calc_days_of_stock < 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    c.calc_last_30_days_sales,
    c.calc_last_7_days_sales
  FROM calculations c
  WHERE c.calc_sales_velocity > 0
  RETURNING *;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;