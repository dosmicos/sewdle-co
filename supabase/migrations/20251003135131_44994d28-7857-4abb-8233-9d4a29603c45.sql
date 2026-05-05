-- Actualizar get_current_organization_safe() para priorizar organizaciones con roles asignados
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Prioridad 1: Organización donde tiene rol asignado en user_roles
  SELECT COALESCE(
    (
      SELECT ou.organization_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = ou.user_id
            AND ur.role_id IS NOT NULL
        )
      ORDER BY ou.joined_at DESC
      LIMIT 1
    ),
    -- Fallback: cualquier organización activa (más reciente primero)
    (
      SELECT ou.organization_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.status = 'active'
      ORDER BY ou.joined_at DESC
      LIMIT 1
    )
  );
$$;

-- Solución inmediata para Alejandra: eliminar su membresía en "Mi Organización"
-- Esto asegura que solo vea datos de "Dosmicos" donde tiene rol asignado
DELETE FROM public.organization_users
WHERE user_id = 'bbb9c5ce-bb2c-47b8-b481-e12419dea8a2'
  AND organization_id = 'a0ddd87c-9e2b-4d15-a008-d9f1dc964699';