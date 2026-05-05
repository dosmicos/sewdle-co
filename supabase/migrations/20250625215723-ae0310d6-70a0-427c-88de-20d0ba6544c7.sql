
-- Corregir warnings de Security Advisor agregando search_path seguro a todas las funciones SECURITY DEFINER

-- 1. make_user_admin
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Buscar el usuario por email en auth.users
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = user_email;
  
  IF user_uuid IS NOT NULL THEN
    -- Insertar o actualizar el rol
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;
END;
$$;

-- 2. mark_password_changed
CREATE OR REPLACE FUNCTION public.mark_password_changed(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = false,
      updated_at = now()
  WHERE id = user_uuid;
END;
$$;

-- 3. require_password_change
CREATE OR REPLACE FUNCTION public.require_password_change(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET requires_password_change = true,
      updated_at = now()
  WHERE id = user_uuid;
END;
$$;

-- 4. generate_delivery_number
CREATE OR REPLACE FUNCTION public.generate_delivery_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_number INTEGER;
  delivery_number TEXT;
BEGIN
  -- Obtener el siguiente número secuencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(tracking_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.deliveries
  WHERE tracking_number LIKE 'DEL-%';
  
  -- Formatear el número de entrega
  delivery_number := 'DEL-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN delivery_number;
END;
$$;

-- 5. get_user_role_info
CREATE OR REPLACE FUNCTION public.get_user_role_info(user_uuid uuid)
RETURNS TABLE(role_name text, permissions jsonb, workshop_id uuid)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    r.name as role_name,
    r.permissions,
    ur.workshop_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- 6. has_permission
CREATE OR REPLACE FUNCTION public.has_permission(user_uuid uuid, module_name text, action_name text)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COALESCE(
      (r.permissions->module_name->>action_name)::boolean, 
      false
    )
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- 7. get_current_user_role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = auth.uid() 
  LIMIT 1;
$$;

-- 8. get_current_user_role_safe
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
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

-- 9. is_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid AND r.name = 'Administrador'
  );
$$;

-- 10. generate_order_number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  -- Obtener el siguiente número secuencial usando alias de tabla
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number LIKE 'ORD-%';
  
  -- Formatear el número de orden
  order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$;

-- 11. get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

-- 12. is_current_user_admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'Administrador'
  );
$$;

-- 13. user_has_workshop_permissions
CREATE OR REPLACE FUNCTION public.user_has_workshop_permissions()
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE true
    END;
$$;

-- 14. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'),
    NEW.email
  );
  RETURN NEW;
END;
$$;
