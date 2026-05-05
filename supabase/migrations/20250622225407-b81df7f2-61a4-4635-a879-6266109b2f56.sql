
-- Paso 1: Eliminar políticas conflictivas existentes
DROP POLICY IF EXISTS "Authenticated users can view material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Authenticated users can create material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Authenticated users can update material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Authenticated users can delete material deliveries" ON public.material_deliveries;

-- Paso 2: Crear función de seguridad para verificar roles (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1),
    'user'
  );
$$;

-- Paso 3: Crear políticas RLS correctas que reconozcan ambos roles
CREATE POLICY "Users with admin role can view material deliveries" 
  ON public.material_deliveries 
  FOR SELECT 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() IN ('admin', 'Administrador')
    OR delivered_by = auth.uid()
  );

CREATE POLICY "Users with admin role can create material deliveries" 
  ON public.material_deliveries 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    public.get_current_user_role_safe() IN ('admin', 'Administrador')
  );

CREATE POLICY "Users with admin role can update material deliveries" 
  ON public.material_deliveries 
  FOR UPDATE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() IN ('admin', 'Administrador')
    OR delivered_by = auth.uid()
  );

CREATE POLICY "Users with admin role can delete material deliveries" 
  ON public.material_deliveries 
  FOR DELETE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() IN ('admin', 'Administrador')
  );

-- Paso 4: Asegurar que RLS esté habilitado
ALTER TABLE public.material_deliveries ENABLE ROW LEVEL SECURITY;
