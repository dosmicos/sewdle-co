
-- Actualizar la función user_can_view_all_deliveries para usar permisos dinámicos
-- en lugar de roles hardcodeados
CREATE OR REPLACE FUNCTION public.user_can_view_all_deliveries(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT 
        -- Si tiene permiso de view en deliveries Y no es un usuario de taller específico
        -- (o es un rol con acceso completo)
        (r.permissions->'deliveries'->>'view')::boolean = true
        AND (
          -- Roles que ven toda la organización (sin filtro de taller)
          r.name IN ('Administrador', 'Diseñador', 'Líder QC', 'Calidad', 'Atención al Cliente', 'Producción', 'Reclutamiento')
          OR
          -- O cualquier rol que tenga workshop_id NULL (no está asignado a un taller específico)
          ur.workshop_id IS NULL
        )
      FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = user_uuid
      LIMIT 1
    ),
    false
  );
$$;
