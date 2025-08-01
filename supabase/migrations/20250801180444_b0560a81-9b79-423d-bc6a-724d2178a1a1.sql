-- Eliminar las políticas actuales problemáticas
DROP POLICY IF EXISTS "Users can view organization members" ON organization_users;
DROP POLICY IF EXISTS "Users can manage their own memberships" ON organization_users;

-- Crear política más directa y permisiva para lectura
CREATE POLICY "Users can view their organization members" ON organization_users
FOR SELECT USING (
  -- Un usuario puede ver:
  -- 1. Su propia membresía en cualquier organización
  user_id = auth.uid()
  OR
  -- 2. Otros usuarios de organizaciones donde él es admin/owner
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  )
);

-- Política para gestión (INSERT/UPDATE/DELETE)
CREATE POLICY "Admins can manage organization members" ON organization_users
FOR ALL USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  )
) WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  )
);