
-- Primero, eliminamos las políticas existentes que pueden estar causando conflictos
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can create deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can update deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Authenticated users can view delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Authenticated users can create delivery items" ON public.delivery_items;
DROP POLICY IF EXISTS "Authenticated users can update delivery items" ON public.delivery_items;

-- Creamos políticas más permisivas para deliveries
CREATE POLICY "Allow authenticated users full access to deliveries" 
  ON public.deliveries 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Creamos políticas más permisivas para delivery_items
CREATE POLICY "Allow authenticated users full access to delivery items" 
  ON public.delivery_items 
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);
