
-- Actualizar los roles del sistema para incluir permisos de insumos
UPDATE public.roles 
SET permissions = permissions || jsonb_build_object(
  'insumos', jsonb_build_object(
    'view', true,
    'create', true,
    'edit', true,
    'delete', true
  )
)
WHERE name = 'Administrador';

UPDATE public.roles 
SET permissions = permissions || jsonb_build_object(
  'insumos', jsonb_build_object(
    'view', true,
    'create', true,
    'edit', false,
    'delete', false
  )
)
WHERE name = 'Taller';

UPDATE public.roles 
SET permissions = permissions || jsonb_build_object(
  'insumos', jsonb_build_object(
    'view', true,
    'create', false,
    'edit', false,
    'delete', false
  )
)
WHERE name = 'Diseñador';

UPDATE public.roles 
SET permissions = permissions || jsonb_build_object(
  'insumos', jsonb_build_object(
    'view', true,
    'create', false,
    'edit', false,
    'delete', false
  )
)
WHERE name = 'Líder QC';
