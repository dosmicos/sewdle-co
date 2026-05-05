-- SOLUCIÓN COMPLETA: Eliminar el problema de organizaciones duplicadas "Mi Organización"

-- Paso 1: Eliminar el trigger que causa el problema
-- Este trigger fue diseñado para auto-registro, pero interfiere cuando 
-- los administradores crean usuarios manualmente
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Paso 2: Limpiar organizaciones "Mi Organización" duplicadas
-- Primero, eliminar los registros de organization_users para organizaciones vacías
DELETE FROM public.organization_users 
WHERE organization_id IN (
  SELECT o.id 
  FROM organizations o
  WHERE o.name = 'Mi Organización'
  AND NOT EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d.organization_id = o.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM orders ord
    WHERE ord.organization_id = o.id
  )
)
AND user_id IN (
  -- Solo usuarios que tienen más de una organización
  SELECT user_id 
  FROM organization_users 
  GROUP BY user_id 
  HAVING COUNT(*) > 1
);

-- Eliminar las organizaciones "Mi Organización" que quedaron sin usuarios
DELETE FROM public.organizations
WHERE name = 'Mi Organización'
AND NOT EXISTS (
  SELECT 1 FROM deliveries d 
  WHERE d.organization_id = organizations.id
)
AND NOT EXISTS (
  SELECT 1 FROM orders ord
  WHERE ord.organization_id = organizations.id
)
AND NOT EXISTS (
  SELECT 1 FROM organization_users ou 
  WHERE ou.organization_id = organizations.id
  AND ou.status = 'active'
);

-- Paso 3: Actualizar perfiles para que apunten a la organización activa correcta
UPDATE profiles p
SET organization_id = (
  SELECT ou.organization_id 
  FROM organization_users ou
  WHERE ou.user_id = p.id 
  AND ou.status = 'active'
  ORDER BY (
    -- Priorizar organizaciones con más actividad
    SELECT COUNT(*) FROM deliveries d WHERE d.organization_id = ou.organization_id
  ) DESC, ou.created_at DESC
  LIMIT 1
)
WHERE p.id IN (
  SELECT user_id 
  FROM organization_users
  GROUP BY user_id
  HAVING COUNT(*) >= 1
)
AND (
  p.organization_id IS NULL 
  OR p.organization_id NOT IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = p.id 
    AND status = 'active'
  )
);

-- Agregar comentario para documentar el cambio
COMMENT ON FUNCTION public.handle_user_confirmation() IS 
'DEPRECATED: Este trigger ha sido deshabilitado para evitar conflictos cuando los administradores crean usuarios manualmente. La función se mantiene por compatibilidad pero el trigger on_auth_user_confirmed ha sido eliminado.';