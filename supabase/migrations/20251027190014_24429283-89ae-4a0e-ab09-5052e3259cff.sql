-- Agregar permiso "picking y packing" al rol Administrador
UPDATE roles
SET permissions = jsonb_set(
  permissions,
  '{picking y packing}',
  '{"view": true, "create": true, "edit": true, "delete": true}'::jsonb,
  true
)
WHERE name = 'Administrador';