-- Arreglar recursión infinita - Limpiar TODAS las políticas problemáticas primero

-- Eliminar TODAS las políticas de organization_users
DROP POLICY IF EXISTS "Organization owners and admins can manage" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_users;
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization memberships" ON public.organization_users;

-- Eliminar TODAS las políticas de profiles  
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Ahora crear políticas ultra-simples sin dependencias circulares
-- Para organization_users: solo acceso a filas propias
CREATE POLICY "Users can view their own memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own memberships" 
ON public.organization_users 
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Para profiles: solo acceso a perfil propio
CREATE POLICY "Users can manage their own profile" 
ON public.profiles 
FOR ALL
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Función ultra-simple para obtener organizaciones sin recursión
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

-- Función ultra-simple para organización actual
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