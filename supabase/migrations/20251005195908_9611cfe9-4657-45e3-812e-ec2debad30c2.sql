-- Agregar el módulo 'prospects' (Reclutamiento) al rol Administrador
UPDATE public.roles
SET permissions = jsonb_set(
  permissions,
  '{prospects}',
  '{"view": true, "create": true, "edit": true, "delete": true}'::jsonb,
  true
)
WHERE name = 'Administrador';