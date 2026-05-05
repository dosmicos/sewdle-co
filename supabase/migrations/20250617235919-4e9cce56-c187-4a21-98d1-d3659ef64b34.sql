
-- Eliminar la restricción existente que está causando el problema
ALTER TABLE public.delivery_items DROP CONSTRAINT IF EXISTS delivery_items_quality_status_check;

-- Crear una nueva restricción que incluya todos los estados necesarios
ALTER TABLE public.delivery_items ADD CONSTRAINT delivery_items_quality_status_check 
CHECK (quality_status IN ('pending', 'approved', 'rejected', 'partial_approved', 'rework_needed'));
