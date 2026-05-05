-- Fix the order delivery stats calculation to avoid duplicated quantities
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
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH order_totals AS (
    -- Total ordenado (sin duplicaciones)
    SELECT COALESCE(SUM(oi.quantity), 0) as total_qty
    FROM public.order_items oi
    WHERE oi.order_id = order_id_param
  ),
  delivery_totals AS (
    -- Totales de entregas para esta orden específica
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as delivered_qty,
      COALESCE(SUM(di.quantity_approved), 0) as approved_qty,
      COALESCE(SUM(di.quantity_defective), 0) as defective_qty
    FROM public.delivery_items di
    JOIN public.deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_id_param
  )
  SELECT 
    ot.total_qty::integer as total_ordered,
    dt.delivered_qty::integer as total_delivered,
    dt.approved_qty::integer as total_approved,
    dt.defective_qty::integer as total_defective,
    GREATEST(0, ot.total_qty - dt.approved_qty)::integer as total_pending,
    CASE 
      WHEN ot.total_qty = 0 THEN 0
      ELSE ROUND((dt.approved_qty::numeric / ot.total_qty::numeric) * 100, 2)
    END as completion_percentage
  FROM order_totals ot, delivery_totals dt;
$function$;