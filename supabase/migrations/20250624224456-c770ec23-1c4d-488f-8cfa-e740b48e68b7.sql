
-- Eliminar la vista actual que tiene SECURITY DEFINER
DROP VIEW IF EXISTS public.deliveries_stats;

-- Recrear la vista con SECURITY INVOKER para que respete los permisos del usuario
CREATE VIEW public.deliveries_stats 
WITH (security_invoker=true)
AS
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
  COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
FROM deliveries;

-- Verificar y agregar políticas RLS para la tabla deliveries si no existen
-- Primero eliminar políticas existentes que puedan estar en conflicto
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Allow authenticated users full access to deliveries" ON public.deliveries;

-- Crear políticas RLS específicas por rol para deliveries
-- Política para ver entregas
CREATE POLICY "Role-based delivery access" 
  ON public.deliveries 
  FOR SELECT 
  TO authenticated 
  USING (
    -- Administradores ven todo
    public.get_current_user_role_safe() = 'Administrador'
    OR 
    -- Diseñadores ven todo
    public.get_current_user_role_safe() = 'Diseñador'
    OR
    -- Talleres solo ven sus entregas
    (
      public.get_current_user_role_safe() NOT IN ('Administrador', 'Diseñador') 
      AND workshop_id IN (
        SELECT ur.workshop_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  );

-- Política para crear entregas (solo admins y diseñadores)
CREATE POLICY "Role-based delivery creation" 
  ON public.deliveries 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    public.get_current_user_role_safe() IN ('Administrador', 'Diseñador')
  );

-- Política para actualizar entregas
CREATE POLICY "Role-based delivery updates" 
  ON public.deliveries 
  FOR UPDATE 
  TO authenticated 
  USING (
    -- Administradores pueden actualizar todo
    public.get_current_user_role_safe() = 'Administrador'
    OR 
    -- Diseñadores pueden actualizar todo
    public.get_current_user_role_safe() = 'Diseñador'
    OR
    -- Talleres solo pueden actualizar sus entregas
    (
      public.get_current_user_role_safe() NOT IN ('Administrador', 'Diseñador') 
      AND workshop_id IN (
        SELECT ur.workshop_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  );

-- Política para eliminar entregas (solo admins)
CREATE POLICY "Admin-only delivery deletion" 
  ON public.deliveries 
  FOR DELETE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() = 'Administrador'
  );

-- Asegurar que RLS esté habilitado en la tabla deliveries
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
