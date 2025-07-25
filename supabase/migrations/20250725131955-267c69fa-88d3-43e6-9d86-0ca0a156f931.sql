-- Create the missing get_order_delivery_stats_v2 function that the frontend is expecting
CREATE OR REPLACE FUNCTION public.get_order_delivery_stats_v2(order_id_param uuid)
RETURNS TABLE(
  total_ordered integer,
  total_delivered integer, 
  total_approved integer,
  total_defective integer,
  total_pending integer,
  completion_percentage numeric
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    -- Total ordenado para esta orden
    COALESCE(SUM(oi.quantity), 0)::integer as total_ordered,
    
    -- Total entregado (suma de delivery_items.quantity_delivered)
    COALESCE(SUM(di.quantity_delivered), 0)::integer as total_delivered,
    
    -- Total aprobado (suma de delivery_items.quantity_approved)
    COALESCE(SUM(di.quantity_approved), 0)::integer as total_approved,
    
    -- Total defectuoso (suma de delivery_items.quantity_defective)
    COALESCE(SUM(di.quantity_defective), 0)::integer as total_defective,
    
    -- Total pendiente (ordenado - aprobado)
    GREATEST(0, 
      COALESCE(SUM(oi.quantity), 0) - COALESCE(SUM(di.quantity_approved), 0)
    )::integer as total_pending,
    
    -- Porcentaje de completitud
    CASE 
      WHEN COALESCE(SUM(oi.quantity), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(di.quantity_approved), 0)::numeric / COALESCE(SUM(oi.quantity), 0)::numeric) * 100, 
        2
      )
    END as completion_percentage
    
  FROM public.order_items oi
  LEFT JOIN public.delivery_items di ON oi.id = di.order_item_id
  LEFT JOIN public.deliveries d ON di.delivery_id = d.id AND d.order_id = order_id_param
  WHERE oi.order_id = order_id_param;
$function$;