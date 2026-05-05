-- ============================================================================
-- PLAN COMPLETO DE CORRECCIÓN DEL SISTEMA DE ROLES
-- ============================================================================
-- FASE 2: Crear Trigger de Sincronización Automática
-- FASE 3: Corregir RLS Policies
-- FASE 4: Migrar Datos Existentes
-- FASE 5: Actualizar Funciones RPC
-- ============================================================================

-- ============================================================================
-- FASE 2: TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA
-- ============================================================================
-- Función para sincronizar organization_users.role basado en user_roles
CREATE OR REPLACE FUNCTION sync_organization_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  app_role_name TEXT;
  org_role TEXT;
BEGIN
  -- Obtener el nombre del rol desde la tabla roles
  SELECT r.name INTO app_role_name
  FROM roles r
  WHERE r.id = COALESCE(NEW.role_id, OLD.role_id);
  
  -- Mapear rol de aplicación → rol de organización
  org_role := CASE app_role_name
    WHEN 'Administrador' THEN 'admin'
    ELSE 'member'
  END;
  
  -- Actualizar organization_users SOLO si cambió
  UPDATE organization_users
  SET role = org_role,
      updated_at = now()
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
  AND role != org_role;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para sincronizar en INSERT/UPDATE/DELETE
DROP TRIGGER IF EXISTS sync_org_role_on_user_role_change ON user_roles;
CREATE TRIGGER sync_org_role_on_user_role_change
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION sync_organization_role();

COMMENT ON FUNCTION sync_organization_role() IS 
'Sincroniza automáticamente organization_users.role cuando cambia user_roles. Mapea Administrador→admin, otros→member.';

-- ============================================================================
-- FASE 3: CORREGIR RLS POLICIES
-- ============================================================================

-- 3.1 - Actualizar RLS de la tabla 'roles'
DROP POLICY IF EXISTS "Only system admins and organization owners can update roles" ON roles;

CREATE POLICY "Only system admins and organization owners can update roles"
ON roles
FOR UPDATE
TO authenticated
USING (
  -- Usar organization_users.role para permisos de organización
  EXISTS (
    SELECT 1 FROM organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.role IN ('owner', 'admin')
    AND ou.status = 'active'
  )
  AND NOT is_system -- No permitir editar roles del sistema
);

-- 3.2 - Actualizar RLS de 'user_roles' para usar el rol de aplicación
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

CREATE POLICY "Admins can manage user roles"
ON user_roles
FOR ALL
TO authenticated
USING (
  -- Usar user_roles para permisos de módulos (no organization_users)
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'Administrador'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = 'Administrador'
  )
);

CREATE POLICY "Users can view their own role"
ON user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- FASE 4: MIGRAR DATOS EXISTENTES
-- ============================================================================

-- Corregir todos los roles desincronizados
UPDATE organization_users ou
SET role = CASE 
  WHEN r.name = 'Administrador' THEN 'admin'
  ELSE 'member'
END,
updated_at = now()
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ou.user_id = ur.user_id
AND (
  (r.name = 'Administrador' AND ou.role != 'admin')
  OR (r.name != 'Administrador' AND ou.role = 'admin' AND ou.role != 'owner')
);

-- ============================================================================
-- FASE 5: ACTUALIZAR FUNCIONES RPC
-- ============================================================================

-- Eliminar función existente primero
DROP FUNCTION IF EXISTS get_organization_users_detailed();

-- Recrear con la firma actualizada (sin last_login por ahora)
CREATE FUNCTION get_organization_users_detailed()
RETURNS TABLE(
  id uuid,
  name text,
  email text,
  role text,
  status text,
  workshop_id uuid,
  workshop_name text,
  created_at timestamptz,
  last_login timestamptz,
  created_by uuid,
  requires_password_change boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    p.id,
    p.name,
    p.email,
    COALESCE(r.name, 'Sin Rol') as role, -- ✅ Usar user_roles → roles.name
    ou.status,
    ur.workshop_id,
    w.name as workshop_name,
    p.created_at,
    NULL::timestamptz as last_login, -- Temporalmente NULL hasta crear tabla de tracking
    ou.invited_by as created_by,
    p.requires_password_change
  FROM profiles p
  JOIN organization_users ou ON p.id = ou.user_id
  LEFT JOIN user_roles ur ON p.id = ur.user_id
  LEFT JOIN roles r ON ur.role_id = r.id
  LEFT JOIN workshops w ON ur.workshop_id = w.id
  WHERE ou.organization_id = get_current_organization_safe()
  AND ou.status = 'active'
  ORDER BY p.created_at DESC;
$$;

COMMENT ON FUNCTION get_organization_users_detailed() IS 
'Retorna usuarios de la organización con su rol de aplicación desde user_roles (no organization_users).';

-- ============================================================================
-- VERIFICACIÓN FINAL
-- ============================================================================

-- Insertar log de auditoría del proceso de corrección
INSERT INTO security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details
) VALUES (
  'role_system_correction',
  auth.uid(),
  get_current_organization_safe(),
  jsonb_build_object(
    'action', 'complete_role_system_correction',
    'phases_completed', ARRAY['trigger_sync', 'rls_policies', 'data_migration', 'rpc_update'],
    'timestamp', now(),
    'description', 'Corrección completa del sistema de roles: sincronización automática, RLS actualizado, datos migrados'
  )
);