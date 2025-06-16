
-- Primero eliminamos las políticas problemáticas de user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can create their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can update their own roles" ON user_roles;
DROP POLICY IF EXISTS "Users can delete their own roles" ON user_roles;

-- Creamos una función security definer para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Políticas simples para user_roles que evitan la recursión
CREATE POLICY "Users can view their own roles" 
  ON user_roles 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles" 
  ON user_roles 
  FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can insert roles" 
  ON user_roles 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can update roles" 
  ON user_roles 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Admins can delete roles" 
  ON user_roles 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ));
