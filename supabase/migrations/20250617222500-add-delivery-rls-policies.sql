
-- Agregar políticas de RLS para la tabla deliveries
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Política para permitir a los usuarios autenticados ver todas las entregas
CREATE POLICY "Authenticated users can view deliveries" 
  ON public.deliveries 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Política para permitir a los usuarios autenticados crear entregas
CREATE POLICY "Authenticated users can create deliveries" 
  ON public.deliveries 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Política para permitir a los usuarios autenticados actualizar entregas
CREATE POLICY "Authenticated users can update deliveries" 
  ON public.deliveries 
  FOR UPDATE 
  TO authenticated
  USING (true);

-- Agregar políticas de RLS para la tabla delivery_items
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- Política para permitir a los usuarios autenticados ver todos los items de entrega
CREATE POLICY "Authenticated users can view delivery items" 
  ON public.delivery_items 
  FOR SELECT 
  TO authenticated
  USING (true);

-- Política para permitir a los usuarios autenticados crear items de entrega
CREATE POLICY "Authenticated users can create delivery items" 
  ON public.delivery_items 
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Política para permitir a los usuarios autenticados actualizar items de entrega
CREATE POLICY "Authenticated users can update delivery items" 
  ON public.delivery_items 
  FOR UPDATE 
  TO authenticated
  USING (true);
