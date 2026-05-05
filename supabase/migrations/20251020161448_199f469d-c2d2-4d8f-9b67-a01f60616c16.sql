-- Fix calculate_replenishment_suggestions to INSERT results into table
DROP FUNCTION IF EXISTS public.calculate_replenishment_suggestions();

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders INTEGER,
  projected_demand INTEGER,
  suggested_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_org_id UUID;
  calculation_date DATE := CURRENT_DATE;
BEGIN
  current_org_id := public.get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  -- Delete existing calculations for today
  DELETE FROM replenishment_suggestions 
  WHERE replenishment_suggestions.calculation_date = calculation_date
    AND organization_id = current_org_id;

  -- Insert and return new calculations
  RETURN QUERY
  WITH sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(CASE 
        WHEN so.created_at_shopify >= NOW() - INTERVAL '30 days' THEN soli.quantity 
        ELSE 0 
      END), 0)::integer as sales_30d,
      COALESCE(SUM(CASE 
        WHEN so.created_at_shopify >= NOW() - INTERVAL '7 days' THEN soli.quantity 
        ELSE 0 
      END), 0)::integer as sales_7d,
      COUNT(DISTINCT DATE(so.created_at_shopify)) FILTER (
        WHERE so.created_at_shopify >= NOW() - INTERVAL '30 days'
      ) as days_with_sales
    FROM product_variants pv
    LEFT JOIN shopify_order_line_items soli 
      ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so
      ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = current_org_id
      AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    GROUP BY pv.id
  ),
  delivered_quantities AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(di.quantity_approved), 0)::integer as total_delivered
    FROM delivery_items di
    JOIN order_items oi ON di.order_item_id = oi.id
    JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.organization_id = current_org_id
      AND di.quantity_approved > 0
    GROUP BY oi.product_variant_id
  ),
  open_orders_data AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as total_ordered,
      COALESCE(MAX(dq.total_delivered), 0)::integer as total_delivered,
      COALESCE(SUM(oi.quantity), 0)::integer - COALESCE(MAX(dq.total_delivered), 0)::integer as open_quantity
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN delivered_quantities dq ON oi.product_variant_id = dq.product_variant_id
    WHERE o.organization_id = current_org_id
    GROUP BY oi.product_variant_id
  ),
  inventory_data AS (
    SELECT 
      pv.id as variant_id,
      pv.product_id,
      pv.size,
      pv.color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0)::integer as current_stock
    FROM product_variants pv
    WHERE pv.product_id IN (
      SELECT id FROM products WHERE organization_id = current_org_id
    )
  ),
  calculated_suggestions AS (
    SELECT 
      inv.variant_id,
      p.name as product_name,
      inv.size as variant_size,
      inv.color as variant_color,
      inv.sku_variant,
      inv.current_stock,
      CASE 
        WHEN COALESCE(sd.days_with_sales, 0) > 0 
        THEN ROUND((sd.sales_30d::numeric / sd.days_with_sales), 2)
        ELSE 0
      END as sales_velocity,
      CASE 
        WHEN COALESCE(sd.sales_30d, 0) > 0 
        THEN ROUND((inv.current_stock::numeric / (sd.sales_30d::numeric / 30)), 1)
        ELSE 999
      END as days_of_stock,
      COALESCE(oo.open_quantity, 0)::integer as open_orders,
      CASE 
        WHEN COALESCE(sd.days_with_sales, 0) > 0 
        THEN ROUND((sd.sales_30d::numeric / sd.days_with_sales) * 30)::integer
        ELSE 0
      END as projected_demand,
      GREATEST(0, 
        CASE 
          WHEN COALESCE(sd.days_with_sales, 0) > 0 
          THEN ROUND((sd.sales_30d::numeric / sd.days_with_sales) * 30)::integer - inv.current_stock - COALESCE(oo.open_quantity, 0)
          ELSE 0
        END
      )::integer as suggested_quantity,
      CASE 
        WHEN inv.current_stock <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 7 THEN 'high'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 14 THEN 'normal'
        ELSE 'low'
      END as urgency_level,
      CASE 
        WHEN inv.current_stock <= 0 AND COALESCE(sd.sales_30d, 0) > 0 
          THEN 'Sin stock y con ventas activas'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 7 
          THEN 'Stock crítico - menos de 7 días'
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 14 
          THEN 'Stock bajo - menos de 14 días'
        WHEN COALESCE(sd.sales_30d, 0) = 0 
          THEN 'Sin ventas recientes'
        ELSE 'Stock suficiente'
      END as reason
    FROM inventory_data inv
    JOIN products p ON inv.product_id = p.id
    LEFT JOIN sales_data sd ON inv.variant_id = sd.variant_id
    LEFT JOIN open_orders_data oo ON inv.variant_id = oo.product_variant_id
    WHERE COALESCE(sd.sales_30d, 0) > 0
       OR inv.current_stock > 0
    ORDER BY 
      CASE 
        WHEN inv.current_stock <= 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 1
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 7 THEN 2
        WHEN COALESCE(sd.sales_30d, 0) > 0 AND 
             (inv.current_stock::numeric / (sd.sales_30d::numeric / 30)) < 14 THEN 3
        ELSE 4
      END,
      sd.sales_30d DESC NULLS LAST
  )
  INSERT INTO replenishment_suggestions (
    variant_id,
    product_name,
    variant_size,
    variant_color,
    sku_variant,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason,
    calculation_date,
    organization_id
  )
  SELECT 
    cs.variant_id,
    cs.product_name,
    cs.variant_size,
    cs.variant_color,
    cs.sku_variant,
    cs.current_stock,
    cs.sales_velocity,
    cs.days_of_stock,
    cs.open_orders,
    cs.projected_demand,
    cs.suggested_quantity,
    cs.urgency_level,
    cs.reason,
    calculation_date,
    current_org_id
  FROM calculated_suggestions cs
  RETURNING 
    variant_id,
    product_name,
    variant_size,
    variant_color,
    sku_variant,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity as open_orders,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason;
END;
$$;