
-- Verificar y crear políticas RLS para material_deliveries
-- Primero eliminamos cualquier política existente que pueda estar causando problemas
DROP POLICY IF EXISTS "Users with admin role can view material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Users with admin role can create material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Users with admin role can update material deliveries" ON public.material_deliveries;
DROP POLICY IF EXISTS "Users with admin role can delete material deliveries" ON public.material_deliveries;

-- Crear políticas más amplias que permitan acceso a usuarios autenticados
-- Los usuarios pueden ver todas las entregas de materiales (necesario para dashboard general)
CREATE POLICY "Authenticated users can view material deliveries" 
  ON public.material_deliveries 
  FOR SELECT 
  TO authenticated 
  USING (true);

-- Solo usuarios con rol admin/diseñador pueden crear entregas
CREATE POLICY "Admin and designer users can create material deliveries" 
  ON public.material_deliveries 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    public.get_current_user_role_safe() IN ('admin', 'Administrador', 'designer', 'Diseñador')
  );

-- Solo usuarios con rol admin/diseñador pueden actualizar entregas
CREATE POLICY "Admin and designer users can update material deliveries" 
  ON public.material_deliveries 
  FOR UPDATE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() IN ('admin', 'Administrador', 'designer', 'Diseñador')
  );

-- Solo usuarios con rol admin pueden eliminar entregas
CREATE POLICY "Admin users can delete material deliveries" 
  ON public.material_deliveries 
  FOR DELETE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() IN ('admin', 'Administrador')
  );

-- Asegurar que RLS esté habilitado
ALTER TABLE public.material_deliveries ENABLE ROW LEVEL SECURITY;
