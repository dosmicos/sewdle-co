-- Permitir a admins de organización actualizar permisos de roles del sistema
CREATE POLICY "Admins can update system role permissions"
ON public.roles
FOR UPDATE
TO authenticated
USING (
  is_system = true 
  AND organization_id = get_current_organization_safe()
  AND EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = roles.organization_id
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'active'
  )
)
WITH CHECK (
  is_system = true
  AND organization_id = get_current_organization_safe()
);