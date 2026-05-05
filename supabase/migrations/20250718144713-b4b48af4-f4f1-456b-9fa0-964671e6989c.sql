-- Actualizar la función get_replenishment_suggestions_with_details para incluir ventas de 30 días
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id uuid, 
  product_name text, 
  variant_size text, 
  variant_color text, 
  sku_variant text, 
  suggested_quantity integer, 
  current_stock integer, 
  sales_velocity numeric, 
  sales_30_days integer,
  days_of_stock numeric, 
  open_orders_quantity integer, 
  projected_demand integer, 
  urgency_level text, 
  reason text, 
  status text, 
  calculation_date date, 
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    rs.id,
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    rs.suggested_quantity,
    rs.current_stock,
    rs.sales_velocity,
    -- Calcular ventas de los últimos 30 días desde sales_metrics
    COALESCE((
      SELECT SUM(sm.sales_quantity)::integer
      FROM public.sales_metrics sm
      WHERE sm.product_variant_id = rs.product_variant_id
      AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as sales_30_days,
    rs.days_of_stock,
    rs.open_orders_quantity,
    rs.projected_demand,
    rs.urgency_level,
    rs.reason,
    rs.status,
    rs.calculation_date,
    rs.created_at
  FROM public.replenishment_suggestions rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  ORDER BY 
    CASE rs.urgency_level 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
    END,
    rs.suggested_quantity DESC,
    p.name, pv.size, pv.color;
$function$;

-- Mejorar la función de sincronización para capturar más datos históricos
-- Actualizar sync-shopify-sales para obtener más días de datos