-- Actualizar la política RLS para organization_users para permitir que los administradores vean todos los usuarios de su organización
DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_users;

-- Nueva política que permite a los admins ver todos los usuarios de su organización
CREATE POLICY "Admins can view all users in their organization" ON organization_users
FOR SELECT USING (
  organization_id = get_current_organization_safe() AND (
    user_id = auth.uid() OR 
    is_current_user_admin()
  )
);

-- También permitir que los usuarios vean su propia membresía
CREATE POLICY "Users can view their own membership" ON organization_users
FOR SELECT USING (user_id = auth.uid());