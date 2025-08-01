-- Reemplazar la política actual con una más directa
DROP POLICY IF EXISTS "Admins can view all users in their organization" ON organization_users;
DROP POLICY IF EXISTS "Users can view their own membership" ON organization_users;

CREATE POLICY "Organization members can view users based on role" ON organization_users
FOR SELECT USING (
  organization_id = get_current_organization_safe() AND (
    -- El usuario puede ver su propia membresía
    user_id = auth.uid() 
    OR
    -- O el usuario tiene rol owner/admin en la organización
    EXISTS (
      SELECT 1 FROM organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.organization_id = organization_users.organization_id
      AND ou.role IN ('owner', 'admin')
      AND ou.status = 'active'
    )
  )
);