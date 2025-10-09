-- Crear política para permitir a administradores actualizar el status de usuarios
CREATE POLICY "Admins can update organization users"
ON public.organization_users
FOR UPDATE
TO authenticated
USING (
  -- El administrador debe estar en la misma organización
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  -- Y debe tener rol de Administrador
  AND get_current_user_role_safe() = 'Administrador'
)
WITH CHECK (
  -- Verificar que el administrador esté en la misma organización
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
  AND get_current_user_role_safe() = 'Administrador'
);