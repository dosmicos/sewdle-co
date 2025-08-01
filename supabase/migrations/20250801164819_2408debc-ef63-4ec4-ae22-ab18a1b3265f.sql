-- Arreglar recursión infinita en políticas RLS de organization_users

-- Primero eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Organization owners and admins can manage" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Recrear políticas ultra-simples sin dependencias circulares
-- Política básica para organization_users: solo acceso a filas propias
CREATE POLICY "Users can view their own memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own memberships" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own memberships" 
ON public.organization_users 
FOR UPDATE 
USING (user_id = auth.uid());

-- Política básica para profiles: solo acceso a perfil propio
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Crear función simple para obtener organizaciones del usuario sin recursión
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active';
$$;

-- Actualizar función get_current_organization_safe para ser ultra-simple
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$$;