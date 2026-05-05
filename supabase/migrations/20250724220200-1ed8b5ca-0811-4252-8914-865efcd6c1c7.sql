-- SECURITY HARDENING PART 3: Fix remaining database functions with mutable search paths

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

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details_v2()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint, total_approved bigint, total_defective bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) as total_approved,
    COALESCE(SUM(di.quantity_defective), 0) as total_defective
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_sync_status()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint, total_approved bigint, total_defective bigint, synced_to_shopify boolean, sync_attempts integer, last_sync_attempt timestamp with time zone, sync_error_message text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) as total_approved,
    COALESCE(SUM(di.quantity_defective), 0) as total_defective,
    d.synced_to_shopify,
    d.sync_attempts,
    d.last_sync_attempt,
    d.sync_error_message
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_orders()
RETURNS TABLE(id uuid, order_number text, client_name text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.client_name,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM public.orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_workshop_capacity_stats()
RETURNS TABLE(workshop_id uuid, workshop_name text, total_capacity integer, current_assignments bigint, available_capacity integer, completion_rate numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    w.id as workshop_id,
    w.name as workshop_name,
    COALESCE(w.capacity, 0) as total_capacity,
    COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress')) as current_assignments,
    GREATEST(0, COALESCE(w.capacity, 0) - COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress'))) as available_capacity,
    CASE 
      WHEN COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled')) > 0 
      THEN ROUND(
        (COUNT(wa.id) FILTER (WHERE wa.status = 'completed')::NUMERIC / 
         COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled'))::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as completion_rate
  FROM public.workshops w
  LEFT JOIN public.workshop_assignments wa ON w.id = wa.workshop_id
  WHERE w.status = 'active'
  GROUP BY w.id, w.name, w.capacity
  ORDER BY w.name;
$function$;