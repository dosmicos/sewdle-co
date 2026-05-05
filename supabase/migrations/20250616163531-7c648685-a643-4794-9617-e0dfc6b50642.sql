
-- Crear tabla para order_supplies (insumos de la orden)
CREATE TABLE public.order_supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para order_files (archivos adjuntos a la orden)
CREATE TABLE public.order_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.order_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para order_supplies
CREATE POLICY "Users can view order supplies" 
  ON public.order_supplies 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create order supplies" 
  ON public.order_supplies 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update order supplies" 
  ON public.order_supplies 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete order supplies" 
  ON public.order_supplies 
  FOR DELETE 
  USING (true);

-- Políticas RLS para order_files
CREATE POLICY "Users can view order files" 
  ON public.order_files 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create order files" 
  ON public.order_files 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update order files" 
  ON public.order_files 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete order files" 
  ON public.order_files 
  FOR DELETE 
  USING (true);

-- Políticas RLS para las tablas existentes que necesitamos
CREATE POLICY "Users can view orders" 
  ON public.orders 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create orders" 
  ON public.orders 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update orders" 
  ON public.orders 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete orders" 
  ON public.orders 
  FOR DELETE 
  USING (true);

-- Políticas RLS para order_items
CREATE POLICY "Users can view order items" 
  ON public.order_items 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create order items" 
  ON public.order_items 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update order items" 
  ON public.order_items 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete order items" 
  ON public.order_items 
  FOR DELETE 
  USING (true);

-- Políticas RLS para products y product_variants
CREATE POLICY "Users can view products" 
  ON public.products 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create products" 
  ON public.products 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update products" 
  ON public.products 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete products" 
  ON public.products 
  FOR DELETE 
  USING (true);

CREATE POLICY "Users can view product variants" 
  ON public.product_variants 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create product variants" 
  ON public.product_variants 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update product variants" 
  ON public.product_variants 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete product variants" 
  ON public.product_variants 
  FOR DELETE 
  USING (true);

-- Políticas RLS para materials
CREATE POLICY "Users can view materials" 
  ON public.materials 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create materials" 
  ON public.materials 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update materials" 
  ON public.materials 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete materials" 
  ON public.materials 
  FOR DELETE 
  USING (true);

-- Función para generar número de orden único
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  -- Obtener el siguiente número secuencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders
  WHERE order_number LIKE 'ORD-%';
  
  -- Formatear el número de orden
  order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para actualizar updated_at en las nuevas tablas
CREATE TRIGGER update_order_supplies_updated_at
    BEFORE UPDATE ON public.order_supplies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_files_updated_at
    BEFORE UPDATE ON public.order_files
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
