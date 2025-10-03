-- Corregir get_current_organization_safe() agregando filtro de organization_id en EXISTS
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT ou.organization_id
      FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
        AND ou.status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = ou.user_id
            AND ur.organization_id = ou.organization_id  -- CRÍTICO: verificar misma org
            AND ur.role_id IS NOT NULL
        )
      ORDER BY ou.joined_at DESC
      LIMIT 1
    ),
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

-- Eliminar membresía de Alejandra en "Mi Organización" con el ID correcto
DELETE FROM public.organization_users
WHERE user_id = '1c10b076-7edc-4634-9d61-f80bb2950536'
  AND organization_id = 'a0ddd87c-9e2b-4d15-a008-d9f1dc964699';