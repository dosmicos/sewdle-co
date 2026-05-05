-- FASE 1: Corregir Permisos de Roles del Sistema

-- 1.1. Actualizar rol "Líder QC" - agregar permiso de creación en deliveries
UPDATE roles 
SET permissions = jsonb_set(
  permissions, 
  '{deliveries,create}', 
  'true'::jsonb
)
WHERE name = 'Líder QC' AND is_system = true;

-- 1.2. Actualizar rol "Diseñador" con permisos consistentes y completos
UPDATE roles 
SET permissions = '{
  "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
  "orders": {"view": true, "create": true, "edit": true, "delete": true},
  "deliveries": {"view": true, "create": true, "edit": true, "delete": true},
  "products": {"view": true, "create": true, "edit": true, "delete": true},
  "workshops": {"view": true, "create": true, "edit": true, "delete": true},
  "insumos": {"view": true, "create": true, "edit": true, "delete": true},
  "replenishment": {"view": true, "create": true, "edit": true, "delete": true},
  "shopify": {"view": true, "create": true, "edit": true, "delete": true},
  "prospects": {"view": true, "create": false, "edit": false, "delete": false},
  "users": {"view": false, "create": false, "edit": false, "delete": false},
  "finances": {"view": true, "create": true, "edit": true, "delete": true}
}'::jsonb
WHERE name = 'Diseñador' AND is_system = true;

-- Verificar que los cambios se aplicaron correctamente
COMMENT ON TABLE roles IS 'Permisos actualizados: Líder QC y Diseñador con permisos consistentes';