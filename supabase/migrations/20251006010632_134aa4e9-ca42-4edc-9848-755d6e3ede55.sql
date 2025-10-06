-- Fix remaining critical functions with mutable search_path

CREATE OR REPLACE FUNCTION public.assign_admin_role_to_users_without_role()
RETURNS TABLE(user_id uuid, assigned boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  user_record RECORD;
  admin_role_id uuid;
  org_id uuid;
BEGIN
  SELECT id INTO admin_role_id
  FROM public.roles 
  WHERE name = 'Administrador' AND is_system = true
  LIMIT 1;
  
  IF admin_role_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, 'Admin role not found'::text;
    RETURN;
  END IF;
  
  FOR user_record IN
    SELECT DISTINCT 
      ou.user_id,
      ou.organization_id
    FROM public.organization_users ou
    LEFT JOIN public.user_roles ur ON ou.user_id = ur.user_id
    WHERE ou.status = 'active' 
      AND ur.user_id IS NULL
  LOOP
    BEGIN
      INSERT INTO public.user_roles (user_id, role_id, organization_id)
      VALUES (user_record.user_id, admin_role_id, user_record.organization_id);
      
      RETURN QUERY SELECT user_record.user_id, true, 'Role assigned successfully'::text;
      
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT user_record.user_id, false, SQLERRM::text;
    END;
  END LOOP;
  
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_material_delivery_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.organization_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.order_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.orders
    WHERE id = NEW.order_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  IF NEW.workshop_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.workshops
    WHERE id = NEW.workshop_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  IF NEW.material_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.materials
    WHERE id = NEW.material_id;
    
    IF NEW.organization_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;
  
  SELECT get_current_organization_safe() INTO NEW.organization_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dosmicos_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT id 
  FROM public.organizations 
  WHERE slug = 'dosmicos-org'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.get_current_organization()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$function$;