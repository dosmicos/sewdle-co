
-- Primero eliminar la función existente y recrearla
DROP FUNCTION IF EXISTS public.get_deliveries_with_sync_status();

-- Recrear con filtro de organización y SECURITY INVOKER
CREATE FUNCTION public.get_deliveries_with_sync_status()
RETURNS TABLE(
  id uuid,
  tracking_number text,
  order_id uuid,
  order_number text,
  workshop_id uuid,
  workshop_name text,
  delivery_date date,
  status text,
  delivered_by uuid,
  delivered_by_name text,
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  notes text,
  created_at timestamptz,
  items_count bigint,
  total_quantity numeric,
  total_approved numeric,
  total_defective numeric,
  synced_to_shopify boolean,
  sync_attempts integer,
  last_sync_attempt timestamptz,
  sync_error_message text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
  WHERE d.organization_id = get_current_organization_safe()
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;
