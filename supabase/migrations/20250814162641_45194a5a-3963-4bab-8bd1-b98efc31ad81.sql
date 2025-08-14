-- CRITICAL SECURITY FIX: Phase 2F - Recreate missing functions and complete security fixes

-- Recreate critical security functions
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$$;

-- Now fix the final functions
CREATE OR REPLACE FUNCTION public.get_delivery_stats_admin()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint, organization_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(d.*) as total_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'rejected') as rejected_deliveries,
    o.name as organization_name
  FROM public.deliveries d
  JOIN public.organizations o ON d.organization_id = o.id
  WHERE d.organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
  GROUP BY o.name;
$$;

-- Final functions that need search_path
CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries
  WHERE organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint)
LANGUAGE sql
STABLE
SET search_path = ''
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
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;

-- Audit final security fix
INSERT INTO public.security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details,
  ip_address
) VALUES (
  'security_hardening_complete',
  auth.uid(),
  get_current_organization_safe(),
  jsonb_build_object(
    'action', 'completed_function_security_fixes',
    'functions_updated', 'all database functions now have SET search_path',
    'security_level', 'critical',
    'timestamp', now(),
    'phase', 'Phase 2 Complete'
  ),
  inet_client_addr()
);