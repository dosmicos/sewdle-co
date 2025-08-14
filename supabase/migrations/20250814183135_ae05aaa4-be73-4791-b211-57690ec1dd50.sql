-- Arreglar la función get_current_organization_safe()
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  ORDER BY ou.joined_at DESC
  LIMIT 1;
$$;

-- Crear función optimizada para obtener usuarios de la organización
CREATE OR REPLACE FUNCTION public.get_organization_users_detailed()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role text,
  workshop_id uuid,
  workshop_name text,
  status text,
  requires_password_change boolean,
  created_at timestamp with time zone,
  last_login timestamp with time zone,
  created_by text
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH current_org AS (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active' 
    LIMIT 1
  )
  SELECT 
    p.id,
    p.name,
    p.email,
    COALESCE(r.name, 'Sin Rol') as role,
    ur.workshop_id,
    w.name as workshop_name,
    CASE 
      WHEN ou.status IS NOT NULL THEN ou.status::text
      ELSE 'inactive'::text 
    END as status,
    COALESCE(p.requires_password_change, false) as requires_password_change,
    p.created_at,
    NULL::timestamp with time zone as last_login, -- Placeholder para last_login
    creator.name as created_by
  FROM public.profiles p
  LEFT JOIN public.organization_users ou ON p.id = ou.user_id 
    AND ou.organization_id = (SELECT organization_id FROM current_org)
  LEFT JOIN public.user_roles ur ON p.id = ur.user_id
  LEFT JOIN public.roles r ON ur.role_id = r.id
  LEFT JOIN public.workshops w ON ur.workshop_id = w.id
  LEFT JOIN public.profiles creator ON ou.invited_by = creator.id
  WHERE (
    -- Usuario está en la organización actual
    ou.organization_id = (SELECT organization_id FROM current_org)
    OR 
    -- O el perfil tiene organization_id que coincide
    p.organization_id = (SELECT organization_id FROM current_org)
  )
  AND (SELECT organization_id FROM current_org) IS NOT NULL
  ORDER BY p.created_at DESC;
$$;

-- Mejorar políticas RLS para administradores - tabla profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

CREATE POLICY "Users can view profiles in their organization" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR 
  (
    -- Administradores pueden ver todos los perfiles de su organización
    get_current_user_role_safe() = 'Administrador' 
    AND organization_id = get_current_organization_safe()
  )
  OR
  (
    -- Usuarios comparten organización
    users_share_organization(auth.uid(), id)
  )
);

-- Crear política para permitir a administradores ver todos los usuarios
CREATE POLICY "Admins can view all organization users" 
ON public.organization_users 
FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  (
    get_current_user_role_safe() = 'Administrador' 
    AND organization_id = get_current_organization_safe()
  )
);

-- Mejorar la función users_share_organization para que sea más robusta
CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users ou1
    JOIN public.organization_users ou2 ON ou1.organization_id = ou2.organization_id
    WHERE ou1.user_id = user1_id 
    AND ou2.user_id = user2_id
    AND ou1.status = 'active' 
    AND ou2.status = 'active'
  );
$$;