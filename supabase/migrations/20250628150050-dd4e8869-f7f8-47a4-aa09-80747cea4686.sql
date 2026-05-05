
-- Fix RLS policies for deliveries table to allow workshop users to create deliveries for their own workshops
DROP POLICY IF EXISTS "Role-based delivery creation" ON public.deliveries;
DROP POLICY IF EXISTS "Role-based delivery access" ON public.deliveries;
DROP POLICY IF EXISTS "Role-based delivery updates" ON public.deliveries;
DROP POLICY IF EXISTS "Admin-only delivery deletion" ON public.deliveries;

-- Create new policies that properly allow workshop users to create deliveries
CREATE POLICY "Users can view deliveries based on role and workshop" 
  ON public.deliveries 
  FOR SELECT 
  TO authenticated 
  USING (
    -- Administradores y diseñadores ven todo
    public.get_current_user_role_safe() IN ('Administrador', 'Diseñador')
    OR 
    -- Talleres solo ven sus entregas
    (
      public.get_current_user_role_safe() = 'Taller'
      AND workshop_id IN (
        SELECT ur.workshop_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  );

-- Policy for creating deliveries - allow workshop users to create deliveries for their own workshop
CREATE POLICY "Users can create deliveries based on role and workshop" 
  ON public.deliveries 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    -- Administradores y diseñadores pueden crear entregas para cualquier taller
    public.get_current_user_role_safe() IN ('Administrador', 'Diseñador')
    OR
    -- Talleres pueden crear entregas solo para su propio taller
    (
      public.get_current_user_role_safe() = 'Taller'
      AND workshop_id IN (
        SELECT ur.workshop_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  );

-- Policy for updating deliveries
CREATE POLICY "Users can update deliveries based on role and workshop" 
  ON public.deliveries 
  FOR UPDATE 
  TO authenticated 
  USING (
    -- Administradores y diseñadores pueden actualizar todo
    public.get_current_user_role_safe() IN ('Administrador', 'Diseñador')
    OR 
    -- Talleres solo pueden actualizar sus entregas
    (
      public.get_current_user_role_safe() = 'Taller'
      AND workshop_id IN (
        SELECT ur.workshop_id 
        FROM public.user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  );

-- Policy for deleting deliveries (only admins)
CREATE POLICY "Only admins can delete deliveries" 
  ON public.deliveries 
  FOR DELETE 
  TO authenticated 
  USING (
    public.get_current_user_role_safe() = 'Administrador'
  );
