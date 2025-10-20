-- Drop both versions of the function to resolve overload conflict
DROP FUNCTION IF EXISTS public.calculate_replenishment_suggestions();
DROP FUNCTION IF EXISTS public.calculate_replenishment_suggestions(uuid);

-- Create the definitive version without parameters
-- Uses get_current_organization_safe() internally
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE (
  product_variant_id uuid,
  order_id uuid,
  product_name text,
  variant_name text,
  variant_size text,
  variant_color text,
  sku text,
  sku_variant text,
  suggested_quantity integer,
  current_stock integer,
  minimum_stock integer,
  maximum_stock integer,
  sales_last_30_days integer,
  sales_last_7_days integer,
  sales_velocity numeric,
  stock_days_remaining numeric,
  open_orders_quantity integer,
  urgency_level text,
  reason text,
  data_quality text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_org_id uuid;
BEGIN
  -- Get current organization
  current_org_id := get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found for current user';
  END IF;

  RETURN QUERY
  WITH delivered_quantities AS (
    -- Calculate total delivered quantities per order_item_id
    SELECT 
      di.order_item_id,
      SUM(di.quantity_approved) as total_delivered
    FROM delivery_items di
    INNER JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.organization_id = current_org_id
    GROUP BY di.order_item_id
  ),
  open_orders_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(
        SUM(oi.quantity - COALESCE(dq.total_delivered, 0)),
        0
      )::integer as open_quantity
    FROM product_variants pv
    LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
    LEFT JOIN orders o ON oi.order_id = o.id
    LEFT JOIN delivered_quantities dq ON oi.id = dq.order_item_id
    WHERE o.status IN ('pending', 'assigned', 'in_production')
      AND o.organization_id = current_org_id
    GROUP BY pv.id
  ),
  sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(CASE 
        WHEN soh.created_at >= NOW() - INTERVAL '30 days' THEN soh.quantity 
        ELSE 0 
      END), 0)::integer as sales_30d,
      COALESCE(SUM(CASE 
        WHEN soh.created_at >= NOW() - INTERVAL '7 days' THEN soh.quantity 
        ELSE 0 
      END), 0)::integer as sales_7d,
      COUNT(DISTINCT DATE(soh.created_at)) as days_with_sales
    FROM product_variants pv
    LEFT JOIN shopify_order_history soh ON pv.shopify_variant_id::text = soh.variant_id::text
    WHERE soh.organization_id = current_org_id
      AND soh.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY pv.id
  ),
  inventory_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(inv.quantity), 0)::integer as current_quantity
    FROM product_variants pv
    LEFT JOIN inventory inv ON pv.id = inv.product_variant_id
    WHERE inv.organization_id = current_org_id
    GROUP BY pv.id
  ),
  config_data AS (
    SELECT 
      rc.product_variant_id,
      rc.min_stock_level,
      rc.max_stock_level,
      rc.lead_time_days,
      rc.safety_days
    FROM replenishment_config rc
    WHERE rc.organization_id = current_org_id
      AND rc.is_active = true
  ),
  variant_analysis AS (
    SELECT 
      pv.id as variant_id,
      pv.product_id,
      p.name as product_name,
      pv.name as variant_name,
      pv.size as variant_size,
      pv.color as variant_color,
      p.sku,
      pv.sku as sku_variant,
      COALESCE(id.current_quantity, 0) as current_stock,
      COALESCE(cd.min_stock_level, 0) as minimum_stock,
      COALESCE(cd.max_stock_level, 100) as maximum_stock,
      COALESCE(sd.sales_30d, 0) as sales_30d,
      COALESCE(sd.sales_7d, 0) as sales_7d,
      COALESCE(ood.open_quantity, 0) as open_orders,
      CASE 
        WHEN sd.days_with_sales > 0 THEN ROUND((sd.sales_30d::numeric / sd.days_with_sales), 2)
        ELSE 0
      END as daily_velocity,
      COALESCE(cd.lead_time_days, 7) as lead_time,
      COALESCE(cd.safety_days, 3) as safety_days,
      CASE
        WHEN sd.sales_30d >= 10 AND sd.days_with_sales >= 10 THEN 'high'
        WHEN sd.sales_30d >= 5 AND sd.days_with_sales >= 5 THEN 'medium'
        WHEN sd.sales_30d > 0 THEN 'low'
        ELSE 'insufficient'
      END as data_quality
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sd ON pv.id = sd.variant_id
    LEFT JOIN inventory_data id ON pv.id = id.variant_id
    LEFT JOIN config_data cd ON pv.id = cd.product_variant_id
    LEFT JOIN open_orders_data ood ON pv.id = ood.variant_id
    WHERE p.organization_id = current_org_id
      AND pv.is_active = true
  ),
  calculations AS (
    SELECT 
      va.*,
      CASE 
        WHEN va.daily_velocity > 0 THEN 
          ROUND((va.current_stock::numeric / va.daily_velocity), 1)
        ELSE 999
      END as days_remaining,
      CASE
        WHEN va.daily_velocity > 0 THEN
          CEIL(va.daily_velocity * (va.lead_time + va.safety_days))
        ELSE va.minimum_stock
      END as projected_demand,
      CASE
        WHEN va.current_stock <= va.minimum_stock THEN 'critical'
        WHEN va.daily_velocity > 0 AND (va.current_stock::numeric / va.daily_velocity) <= va.lead_time THEN 'high'
        WHEN va.daily_velocity > 0 AND (va.current_stock::numeric / va.daily_velocity) <= (va.lead_time + va.safety_days) THEN 'normal'
        ELSE 'low'
      END as urgency
    FROM variant_analysis va
  )
  SELECT 
    c.variant_id as product_variant_id,
    NULL::uuid as order_id,
    c.product_name,
    c.variant_name,
    c.variant_size,
    c.variant_color,
    c.sku,
    c.sku_variant,
    GREATEST(
      c.projected_demand - c.current_stock - c.open_orders,
      0
    )::integer as suggested_quantity,
    c.current_stock,
    c.minimum_stock,
    c.maximum_stock,
    c.sales_30d as sales_last_30_days,
    c.sales_7d as sales_last_7_days,
    c.daily_velocity as sales_velocity,
    c.days_remaining as stock_days_remaining,
    c.open_orders as open_orders_quantity,
    c.urgency as urgency_level,
    CASE
      WHEN c.urgency = 'critical' THEN 
        'Stock crítico: ' || c.current_stock || ' unidades, mínimo ' || c.minimum_stock
      WHEN c.urgency = 'high' THEN 
        'Stock bajo: Solo quedan ' || ROUND(c.days_remaining, 1) || ' días de inventario'
      WHEN c.urgency = 'normal' THEN 
        'Reposición preventiva: ' || ROUND(c.days_remaining, 1) || ' días restantes'
      ELSE 'Stock suficiente'
    END as reason,
    c.data_quality
  FROM calculations c
  WHERE c.projected_demand - c.current_stock - c.open_orders > 0
    OR c.urgency IN ('critical', 'high')
  ORDER BY 
    CASE c.urgency 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      ELSE 4 
    END,
    c.days_remaining ASC,
    c.sales_7d DESC;
END;
$$;