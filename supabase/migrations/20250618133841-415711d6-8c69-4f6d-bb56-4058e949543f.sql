
-- Actualizar el constraint de la tabla deliveries para incluir partial_approved
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;

-- Crear el constraint correcto que incluya partial_approved
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_status_check 
CHECK (status IN ('pending', 'in_transit', 'delivered', 'in_quality', 'approved', 'rejected', 'partial_approved', 'returned'));
