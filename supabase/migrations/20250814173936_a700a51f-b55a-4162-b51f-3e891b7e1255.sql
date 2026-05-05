-- Fix remaining database functions with mutable search_path

-- Fix set_organization_id function
CREATE OR REPLACE FUNCTION public.set_organization_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix update_organizations_updated_at function
CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_organization_users_updated_at function
CREATE OR REPLACE FUNCTION public.update_organization_users_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix get_user_organizations function
CREATE OR REPLACE FUNCTION public.get_user_organizations()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active';
$function$;

-- Fix has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(user_id uuid, module_name text, action_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id
    AND (
      r.permissions->module_name->action_name = 'true'::jsonb
      OR r.name IN ('Administrador', 'admin')
    )
  );
$function$;

-- Fix is_system_or_service_role function
CREATE OR REPLACE FUNCTION public.is_system_or_service_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT auth.jwt() ->> 'role' IN ('service_role', 'supabase_admin', 'postgres')
  OR current_setting('role') IN ('service_role', 'supabase_admin', 'postgres');
$function$;

-- Fix update_delivery_sync_status function
CREATE OR REPLACE FUNCTION public.update_delivery_sync_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  total_items INTEGER;
  synced_items INTEGER;
  delivery_uuid UUID;
BEGIN
  delivery_uuid := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF delivery_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT COUNT(*) INTO total_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  SELECT COUNT(*) INTO synced_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND synced_to_shopify = true;
  
  UPDATE public.deliveries 
  SET synced_to_shopify = (synced_items = total_items AND total_items > 0),
      updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix update_order_status_from_deliveries function
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  order_uuid UUID;
  has_deliveries BOOLEAN;
BEGIN
  order_uuid := COALESCE(NEW.order_id, OLD.order_id);
  
  IF order_uuid IS NULL THEN
    SELECT d.order_id INTO order_uuid
    FROM public.deliveries d
    WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  END IF;
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM public.order_items 
  WHERE order_id = order_uuid;
  
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM public.delivery_items di
  JOIN public.deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid;
  
  SELECT EXISTS(SELECT 1 FROM public.deliveries WHERE order_id = order_uuid) INTO has_deliveries;
  
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = order_uuid;
  ELSIF has_deliveries THEN
    UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = order_uuid;
  ELSIF EXISTS (SELECT 1 FROM public.workshop_assignments WHERE order_id = order_uuid AND status IN ('assigned', 'in_progress')) THEN
    UPDATE public.orders SET status = 'assigned', updated_at = now() WHERE id = order_uuid;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix get_user_role_info function
CREATE OR REPLACE FUNCTION public.get_user_role_info(user_uuid uuid)
 RETURNS TABLE(role_name text, permissions jsonb, workshop_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT 
    r.name as role_name,
    r.permissions,
    ur.workshop_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$function$;

-- Fix log_stats_access function
CREATE OR REPLACE FUNCTION public.log_stats_access()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.sync_control_logs (
    sync_type,
    sync_mode, 
    status,
    error_message,
    execution_details
  ) VALUES (
    'security_audit',
    'stats_access',
    'completed',
    format('User %s accessed delivery stats', auth.uid()::text),
    jsonb_build_object(
      'user_id', auth.uid(),
      'organization_id', public.get_current_organization_safe(),
      'access_type', 'delivery_stats',
      'timestamp', now()
    )
  );
END;
$function$;

-- Create comprehensive audit logging function
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type_param TEXT,
  event_details_param JSONB DEFAULT NULL,
  ip_address_param INET DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.security_audit_log (
    event_type,
    user_id,
    organization_id,
    event_details,
    ip_address,
    created_at
  ) VALUES (
    event_type_param,
    auth.uid(),
    public.get_current_organization_safe(),
    event_details_param,
    ip_address_param,
    now()
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$function$;