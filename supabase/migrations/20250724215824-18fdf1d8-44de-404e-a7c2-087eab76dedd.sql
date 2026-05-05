-- SECURITY HARDENING: Fix all database functions with mutable search paths
-- This prevents search path manipulation attacks

-- 1. Fix user role and permission functions
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(user_uuid uuid, module_name text, action_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    COALESCE(
      (r.permissions->module_name->>action_name)::boolean, 
      false
    )
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid AND r.name = 'Administrador'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Administrador'
  );
$function$;

-- 2. Fix order and delivery functions
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number LIKE 'ORD-%';
  
  order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN order_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_delivery_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  next_number INTEGER;
  delivery_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(tracking_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.deliveries
  WHERE tracking_number LIKE 'DEL-%';
  
  delivery_number := 'DEL-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN delivery_number;
END;
$function$;

-- 3. Fix user management functions
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  user_uuid uuid;
  admin_role_id uuid;
BEGIN
  -- Only allow current admins to make other users admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Only administrators can assign admin roles';
  END IF;
  
  -- Find user by email
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found with email: %', user_email;
  END IF;
  
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM public.roles
  WHERE name = 'Administrador';
  
  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Admin role not found';
  END IF;
  
  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (user_uuid, admin_role_id)
  ON CONFLICT (user_id) DO UPDATE SET role_id = admin_role_id;
  
  -- Log the role assignment
  INSERT INTO public.sync_control_logs (sync_type, sync_mode, status, start_time, end_time, error_message)
  VALUES (
    'security_audit',
    'manual',
    'completed',
    now(),
    now(),
    format('Admin role assigned to user %s by %s', user_email, auth.email())
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_password_changed(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = false,
      updated_at = now()
  WHERE id = user_uuid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.require_password_change(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = true,
      updated_at = now()
  WHERE id = user_uuid;
END;
$function$;

-- 4. Fix material and inventory functions
CREATE OR REPLACE FUNCTION public.generate_material_sku(category_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  category_prefix TEXT;
  next_number INTEGER;
  new_sku TEXT;
BEGIN
  category_prefix := CASE 
    WHEN category_name = 'Telas' THEN 'TEL'
    WHEN category_name = 'Avíos' THEN 'AVI'
    WHEN category_name = 'Etiquetas' THEN 'ETI'
    WHEN category_name = 'Hilos' THEN 'HIL'
    WHEN category_name = 'Cremalleras' THEN 'CRE'
    WHEN category_name = 'Elásticos' THEN 'ELA'
    WHEN category_name = 'Forros' THEN 'FOR'
    WHEN category_name = 'Entretelas' THEN 'ENT'
    ELSE 'MAT'
  END;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM LENGTH(category_prefix) + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.materials
  WHERE sku LIKE category_prefix || '%';
  
  new_sku := category_prefix || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_sku;
END;
$function$;

-- 5. Log security hardening completion
INSERT INTO public.sync_control_logs (sync_type, sync_mode, status, start_time, end_time, error_message)
VALUES (
  'security_hardening',
  'manual',
  'completed',
  now(),
  now(),
  'Database functions secured with search_path protection and role validation added'
);