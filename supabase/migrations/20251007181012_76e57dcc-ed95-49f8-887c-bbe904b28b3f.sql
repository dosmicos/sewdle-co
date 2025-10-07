-- FASE 1: Crear función SECURITY DEFINER para verificar roles sin recursión
CREATE OR REPLACE FUNCTION public.user_has_role(
  check_user_id uuid, 
  role_name text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = check_user_id
    AND r.name = role_name
  );
$$;

-- FASE 2: Limpiar y recrear políticas RLS de user_roles (de 7 a 2 políticas)
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Organization admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can assign roles to others" ON user_roles;
DROP POLICY IF EXISTS "Admins can update others roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete others roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Users can view roles in their organization" ON user_roles;

-- Política 1: SELECT (Ver roles)
CREATE POLICY "Users can view roles"
ON user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() -- Usuario ve su propio rol
  OR public.user_has_role(auth.uid(), 'Administrador') -- O es admin
);

-- Política 2: INSERT/UPDATE/DELETE (Gestionar roles)
CREATE POLICY "Admins can manage roles"
ON user_roles
FOR ALL
TO authenticated
USING (
  public.user_has_role(auth.uid(), 'Administrador')
  AND user_id != auth.uid() -- No puede modificar su propio rol
)
WITH CHECK (
  public.user_has_role(auth.uid(), 'Administrador')
  AND user_id != auth.uid()
);

-- FASE 3: Simplificar políticas RLS de roles (de 5 a 3 políticas)
DROP POLICY IF EXISTS "Admins can update system role permissions" ON roles;
DROP POLICY IF EXISTS "Only system admins and organization owners can update roles" ON roles;
DROP POLICY IF EXISTS "Organization admins can manage custom roles" ON roles;
DROP POLICY IF EXISTS "Authenticated users can view roles in their organization" ON roles;
DROP POLICY IF EXISTS "Users can view roles in their organization" ON roles;

-- Política 1: SELECT (Ver roles)
CREATE POLICY "Users can view roles"
ON roles
FOR SELECT
TO authenticated
USING (
  is_system = true -- Roles del sistema son públicos
  OR organization_id = get_current_organization_safe() -- O roles de su org
);

-- Política 2: INSERT/UPDATE/DELETE (Gestionar roles personalizados)
CREATE POLICY "Admins can manage custom roles"
ON roles
FOR ALL
TO authenticated
USING (
  organization_id = get_current_organization_safe()
  AND is_system = false
  AND (
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = roles.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'active'
    )
  )
)
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND is_system = false
);

-- Política 3: UPDATE de roles del sistema (solo owner/admin)
CREATE POLICY "Owners can update system roles"
ON roles
FOR UPDATE
TO authenticated
USING (
  is_system = true
  AND EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'active'
  )
)
WITH CHECK (
  is_system = true
);

-- FASE 4: Registrar corrección en security_audit_log
INSERT INTO security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details
) VALUES (
  'rls_policy_correction',
  auth.uid(),
  get_current_organization_safe(),
  jsonb_build_object(
    'action', 'fix_infinite_recursion',
    'changes', jsonb_build_array(
      'Created user_has_role() SECURITY DEFINER function',
      'Removed 7 conflicting policies from user_roles',
      'Created 2 new policies for user_roles',
      'Simplified 5 policies on roles table to 3'
    ),
    'timestamp', now()
  )
);