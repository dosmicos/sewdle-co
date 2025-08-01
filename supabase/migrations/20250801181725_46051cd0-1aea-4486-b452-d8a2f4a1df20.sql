-- Eliminar todas las políticas problemáticas de organization_users
DROP POLICY IF EXISTS "Users can view their organization members" ON organization_users;
DROP POLICY IF EXISTS "Admins can manage organization members" ON organization_users;
DROP POLICY IF EXISTS "Users can manage their own memberships" ON organization_users;

-- Crear política ultra-simple que solo verifica autenticación
-- Sin consultas recursivas a organization_users
CREATE POLICY "Authenticated users can access organization_users" ON organization_users
FOR ALL USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);