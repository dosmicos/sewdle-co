-- Crear función security definer para evitar recursión infinita
CREATE OR REPLACE FUNCTION public.user_has_org_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = get_current_organization_safe()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
$$;

-- Eliminar la política problemática que causa recursión infinita
DROP POLICY IF EXISTS "Organization members can view users based on role" ON organization_users;

-- Crear nueva política sin recursión usando la función security definer
CREATE POLICY "Users can view organization members" ON organization_users
FOR SELECT USING (
  organization_id = get_current_organization_safe() AND (
    user_id = auth.uid() OR user_has_org_admin_role()
  )
);