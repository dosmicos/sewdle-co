-- Fix: Agregar módulo prospects al rol Diseñador
-- Esto es una solución inmediata para desbloquear el trabajo

UPDATE public.roles 
SET permissions = permissions || '{"prospects": {"view": true, "create": false, "edit": false, "delete": false}}'::jsonb
WHERE name = 'Diseñador';