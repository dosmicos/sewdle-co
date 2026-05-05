
-- Corregir la función generate_order_number para evitar ambigüedad en la referencia de columnas
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  order_number TEXT;
BEGIN
  -- Obtener el siguiente número secuencial usando alias de tabla
  SELECT COALESCE(MAX(CAST(SUBSTRING(o.order_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.orders o
  WHERE o.order_number LIKE 'ORD-%';
  
  -- Formatear el número de orden
  order_number := 'ORD-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
