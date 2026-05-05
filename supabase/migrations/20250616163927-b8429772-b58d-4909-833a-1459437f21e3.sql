
-- Eliminar las columnas de información del cliente de la tabla orders
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS client_name,
DROP COLUMN IF EXISTS client_email,
DROP COLUMN IF EXISTS client_phone;
