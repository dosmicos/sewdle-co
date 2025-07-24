-- SECURITY HARDENING PART 3 FIXED: Fix remaining database functions with mutable search paths

CREATE OR REPLACE FUNCTION public.get_workshop_product_price(workshop_id_param uuid, product_id_param uuid, calculation_date date DEFAULT CURRENT_DATE)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT wp.unit_price
  FROM public.workshop_pricing wp
  WHERE wp.workshop_id = workshop_id_param
    AND wp.product_id = product_id_param
    AND wp.effective_from <= calculation_date
    AND (wp.effective_until IS NULL OR wp.effective_until > calculation_date)
  ORDER BY wp.effective_from DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_orders()
RETURNS TABLE(id uuid, order_number text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM public.orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_delivery_stats(order_id_param uuid)
RETURNS TABLE(total_ordered integer, total_delivered integer, total_approved integer, total_defective integer, total_pending integer, completion_percentage numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH order_totals AS (
    SELECT 
      COALESCE(SUM(oi.quantity), 0) as total_ordered_qty
    FROM public.order_items oi
    WHERE oi.order_id = order_id_param
  ),
  delivery_stats AS (
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as total_delivered_qty,
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'approved' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0) as total_approved_qty,
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'rejected' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Defectuosas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0) as total_defective_qty
    FROM public.delivery_items di
    INNER JOIN public.deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_id_param
  )
  SELECT 
    ot.total_ordered_qty::INTEGER as total_ordered,
    ds.total_delivered_qty::INTEGER as total_delivered,
    ds.total_approved_qty::INTEGER as total_approved,
    ds.total_defective_qty::INTEGER as total_defective,
    GREATEST(0, ot.total_ordered_qty - ds.total_approved_qty)::INTEGER as total_pending,
    CASE 
      WHEN ot.total_ordered_qty = 0 THEN 0
      ELSE ROUND((ds.total_approved_qty::NUMERIC / ot.total_ordered_qty::NUMERIC) * 100, 2)
    END as completion_percentage
  FROM order_totals ot
  CROSS JOIN delivery_stats ds;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_delivery_stats_v2(order_id_param uuid)
RETURNS TABLE(total_ordered integer, total_delivered integer, total_approved integer, total_defective integer, total_pending integer, completion_percentage numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH order_totals AS (
    SELECT 
      COALESCE(SUM(oi.quantity), 0) as total_ordered_qty
    FROM public.order_items oi
    WHERE oi.order_id = order_id_param
  ),
  delivery_stats AS (
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as total_delivered_qty,
      COALESCE(SUM(di.quantity_approved), 0) as total_approved_qty,
      COALESCE(SUM(di.quantity_defective), 0) as total_defective_qty
    FROM public.delivery_items di
    INNER JOIN public.deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_id_param
  )
  SELECT 
    ot.total_ordered_qty::INTEGER as total_ordered,
    ds.total_delivered_qty::INTEGER as total_delivered,
    ds.total_approved_qty::INTEGER as total_approved,
    ds.total_defective_qty::INTEGER as total_defective,
    GREATEST(0, ot.total_ordered_qty - ds.total_approved_qty)::INTEGER as total_pending,
    CASE 
      WHEN ot.total_ordered_qty = 0 THEN 0
      ELSE ROUND((ds.total_approved_qty::NUMERIC / ot.total_ordered_qty::NUMERIC) * 100, 2)
    END as completion_percentage
  FROM order_totals ot
  CROSS JOIN delivery_stats ds;
$function$;

CREATE OR REPLACE FUNCTION public.get_order_deliveries_breakdown(order_id_param uuid)
RETURNS TABLE(delivery_id uuid, tracking_number text, delivery_date date, delivery_status text, workshop_name text, items_delivered integer, items_approved integer, items_defective integer, delivery_notes text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.delivery_date,
    d.status as delivery_status,
    w.name as workshop_name,
    
    COALESCE(SUM(di.quantity_delivered), 0)::INTEGER as items_delivered,
    COALESCE(SUM(di.quantity_approved), 0)::INTEGER as items_approved,
    COALESCE(SUM(di.quantity_defective), 0)::INTEGER as items_defective,
    
    d.notes as delivery_notes
    
  FROM public.deliveries d
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  WHERE d.order_id = order_id_param
  GROUP BY d.id, d.tracking_number, d.delivery_date, d.status, w.name, d.notes
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$function$;