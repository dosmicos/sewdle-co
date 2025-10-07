-- 🔥 FASE 5: Crear función de debugging de permisos RLS
-- Esta función ayuda a diagnosticar problemas de permisos al actualizar roles

CREATE OR REPLACE FUNCTION debug_role_update_permissions()
RETURNS TABLE(
  user_id uuid,
  user_email text,
  user_name text,
  org_role text,
  org_status text,
  can_update_system_roles boolean,
  organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    auth.uid() as user_id,
    p.email as user_email,
    p.name as user_name,
    ou.role as org_role,
    ou.status as org_status,
    EXISTS (
      SELECT 1 FROM organization_users ou2
      WHERE ou2.user_id = auth.uid()
      AND ou2.role = ANY(ARRAY['owner', 'admin'])
      AND ou2.status = 'active'
    ) as can_update_system_roles,
    ou.organization_id
  FROM profiles p
  JOIN organization_users ou ON p.id = ou.user_id
  WHERE p.id = auth.uid();
$$;

COMMENT ON FUNCTION debug_role_update_permissions() IS 
'Función de debugging para verificar permisos del usuario actual antes de actualizar roles. 
Ayuda a diagnosticar problemas con políticas RLS.
Uso: SELECT * FROM debug_role_update_permissions();';