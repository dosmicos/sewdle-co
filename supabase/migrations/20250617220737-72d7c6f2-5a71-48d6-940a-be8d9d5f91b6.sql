
-- Primero, veamos qué valores están permitidos actualmente y corrijamos el constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Crear el constraint correcto para permitir los status que usa la aplicación
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled'));
