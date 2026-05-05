-- Crear función security definer para verificar si dos usuarios comparten organización
CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_users ou1
    JOIN organization_users ou2 ON ou1.organization_id = ou2.organization_id
    WHERE ou1.user_id = user1_id 
    AND ou2.user_id = user2_id
    AND ou1.status = 'active'
    AND ou2.status = 'active'
  );
$$;

-- Eliminar política restrictiva actual de profiles
DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;

-- Crear nuevas políticas para profiles
-- SELECT: Usuarios pueden ver su propio perfil y perfiles de usuarios de su misma organización
CREATE POLICY "Users can view profiles in their organization" ON profiles
FOR SELECT USING (
  auth.uid() = id OR users_share_organization(auth.uid(), id)
);

-- INSERT/UPDATE/DELETE: Solo su propio perfil
CREATE POLICY "Users can manage their own profile" ON profiles
FOR ALL USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);