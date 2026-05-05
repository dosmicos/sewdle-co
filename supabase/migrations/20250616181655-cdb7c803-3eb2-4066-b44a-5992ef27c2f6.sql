
-- Agregar campos faltantes a la tabla materials si no existen
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stock INTEGER DEFAULT 0;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_materials_sku ON public.materials(sku);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);
CREATE INDEX IF NOT EXISTS idx_materials_current_stock ON public.materials(current_stock);

-- Habilitar RLS en materials si no está habilitado
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para materials
DROP POLICY IF EXISTS "Users can view materials" ON public.materials;
DROP POLICY IF EXISTS "Users can create materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials" ON public.materials;
DROP POLICY IF EXISTS "Users can delete materials" ON public.materials;

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

-- Función para obtener materiales con estado de stock
CREATE OR REPLACE FUNCTION public.get_materials_with_stock_status()
RETURNS TABLE (
  id UUID,
  sku TEXT,
  name TEXT,
  description TEXT,
  unit TEXT,
  color TEXT,
  category TEXT,
  min_stock_alert INTEGER,
  current_stock INTEGER,
  supplier TEXT,
  unit_cost NUMERIC,
  image_url TEXT,
  stock_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    m.id,
    m.sku,
    m.name,
    m.description,
    m.unit,
    m.color,
    m.category,
    m.min_stock_alert,
    m.current_stock,
    m.supplier,
    m.unit_cost,
    m.image_url,
    CASE 
      WHEN m.current_stock <= m.min_stock_alert THEN 'critical'
      WHEN m.current_stock <= (m.min_stock_alert * 1.5) THEN 'warning'
      ELSE 'good'
    END as stock_status,
    m.created_at
  FROM materials m
  ORDER BY m.name;
$$;

-- Función para generar SKU automáticamente
CREATE OR REPLACE FUNCTION public.generate_material_sku(category_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  category_prefix TEXT;
  next_number INTEGER;
  new_sku TEXT;
BEGIN
  -- Obtener prefijo basado en categoría
  category_prefix := CASE 
    WHEN category_name = 'Telas' THEN 'TEL'
    WHEN category_name = 'Avíos' THEN 'AVI'
    WHEN category_name = 'Etiquetas' THEN 'ETI'
    WHEN category_name = 'Hilos' THEN 'HIL'
    WHEN category_name = 'Cremalleras' THEN 'CRE'
    WHEN category_name = 'Elásticos' THEN 'ELA'
    WHEN category_name = 'Forros' THEN 'FOR'
    WHEN category_name = 'Entretelas' THEN 'ENT'
    ELSE 'MAT'
  END;
  
  -- Obtener el siguiente número secuencial para esta categoría
  SELECT COALESCE(MAX(CAST(SUBSTRING(sku FROM LENGTH(category_prefix) + 1) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.materials
  WHERE sku LIKE category_prefix || '%';
  
  -- Formatear el SKU
  new_sku := category_prefix || LPAD(next_number::TEXT, 3, '0');
  
  RETURN new_sku;
END;
$$;

-- Trigger para actualizar updated_at en materials
DROP TRIGGER IF EXISTS update_materials_updated_at ON public.materials;
CREATE TRIGGER update_materials_updated_at
    BEFORE UPDATE ON public.materials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar algunos materiales de ejemplo si la tabla está vacía
INSERT INTO public.materials (sku, name, description, unit, color, category, min_stock_alert, current_stock, supplier)
SELECT * FROM (VALUES
  ('TEL001', 'Tela Algodón Premium', 'Tela de algodón 100% para prendas infantiles', 'metros', 'Azul Marino', 'Telas', 50, 25, 'Textiles del Norte'),
  ('AVI001', 'Botones Plásticos 15mm', 'Botones redondos blancos', 'unidades', 'Blanco', 'Avíos', 100, 150, 'Avíos y Más'),
  ('ETI001', 'Etiquetas Marca', 'Etiquetas bordadas con logo', 'unidades', 'Negro', 'Etiquetas', 200, 50, 'Etiquetas Pro'),
  ('HIL001', 'Hilo Poliéster Blanco', 'Hilo resistente para costura', 'rollos', 'Blanco', 'Hilos', 20, 35, 'Hilos Industriales'),
  ('TEL002', 'Tela Poliéster', 'Tela sintética resistente', 'metros', 'Gris', 'Telas', 30, 15, 'Textiles del Norte'),
  ('AVI002', 'Cremalleras 20cm', 'Cremalleras metálicas', 'unidades', 'Negro', 'Avíos', 50, 80, 'Avíos y Más')
) AS v(sku, name, description, unit, color, category, min_stock_alert, current_stock, supplier)
WHERE NOT EXISTS (SELECT 1 FROM public.materials LIMIT 1);
