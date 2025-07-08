-- Cambiar campos de cantidad de INTEGER a NUMERIC para soportar decimales
ALTER TABLE public.material_deliveries 
ALTER COLUMN quantity_delivered TYPE NUMERIC USING quantity_delivered::NUMERIC,
ALTER COLUMN quantity_consumed TYPE NUMERIC USING quantity_consumed::NUMERIC,
ALTER COLUMN quantity_remaining TYPE NUMERIC USING quantity_remaining::NUMERIC;