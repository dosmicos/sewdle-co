
-- Actualizar permisos del rol "Líder QC" para incluir acceso a talleres
UPDATE public.roles 
SET permissions = jsonb_set(
  permissions, 
  '{workshops}', 
  '{"view": true}'
)
WHERE name = 'Líder QC';

-- Verificar que el rol existe y tiene los permisos correctos
-- Esta consulta es solo para verificación (no modifica datos)
SELECT name, permissions 
FROM public.roles 
WHERE name = 'Líder QC';
