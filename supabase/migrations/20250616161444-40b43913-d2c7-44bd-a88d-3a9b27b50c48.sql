
-- Primero, vamos a deshabilitar temporalmente RLS en user_roles para evitar la recursión
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas problemáticas de user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Crear una función simple y segura para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    'user'
  );
$$;

-- Simplificar las políticas de workshops para evitar problemas de recursión
DROP POLICY IF EXISTS "Authenticated users can view workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can create workshops" ON workshops; 
DROP POLICY IF EXISTS "Authenticated users can update workshops" ON workshops;
DROP POLICY IF EXISTS "Authenticated users can delete workshops" ON workshops;

-- Crear políticas más simples para workshops que no dependan de roles complejos
CREATE POLICY "Anyone authenticated can view workshops" 
  ON workshops 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Anyone authenticated can create workshops" 
  ON workshops 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update workshops" 
  ON workshops 
  FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "Anyone authenticated can delete workshops" 
  ON workshops 
  FOR DELETE 
  TO authenticated 
  USING (true);

-- Crear un usuario admin inicial si no existe
DO $$
BEGIN
  -- Insertar rol de admin para el usuario actual si está autenticado
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignorar errores si no se puede insertar
  NULL;
END $$;
