-- Arreglar recursión infinita en políticas RLS de organization_users

-- Primero eliminar las políticas problemáticas
DROP POLICY IF EXISTS "Organization admins can manage memberships" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization memberships" ON public.organization_users;

-- Recrear políticas sin dependencias circulares
-- Política simple para permitir que los usuarios vean sus propias membresías
CREATE POLICY "Users can view their own memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

-- Política para que los admins/owners puedan gestionar membresías dentro de su organización
CREATE POLICY "Organization owners and admins can manage" 
ON public.organization_users 
FOR ALL 
USING (
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.role IN ('owner', 'admin') 
    AND ou.status = 'active'
  )
);

-- Arreglar políticas de profiles que también podrían tener problemas
DROP POLICY IF EXISTS "Admins can view all profiles in organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Recrear política simple para profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id OR 
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.status = 'active'
  )
);

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

-- Actualizar función get_current_organization_safe para usar la nueva función
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