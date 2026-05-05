
-- Crear función para generar número de entrega único
CREATE OR REPLACE FUNCTION public.generate_delivery_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_number INTEGER;
  delivery_number TEXT;
BEGIN
  -- Obtener el siguiente número secuencial
  SELECT COALESCE(MAX(CAST(SUBSTRING(tracking_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_number
  FROM public.deliveries
  WHERE tracking_number LIKE 'DEL-%';
  
  -- Formatear el número de entrega
  delivery_number := 'DEL-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN delivery_number;
END;
$$;

-- Crear función para calcular estadísticas de entregas
CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(
  total_deliveries bigint,
  pending_deliveries bigint,
  in_quality_deliveries bigint,
  approved_deliveries bigint,
  rejected_deliveries bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM deliveries;
$$;

-- Crear función para obtener entregas con detalles completos
CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
RETURNS TABLE(
  id uuid,
  tracking_number text,
  order_id uuid,
  order_number text,
  workshop_id uuid,
  workshop_name text,
  delivery_date date,
  status text,
  delivered_by uuid,
  delivered_by_name text,
  recipient_name text,
  recipient_phone text,
  recipient_address text,
  notes text,
  created_at timestamp with time zone,
  items_count bigint,
  total_quantity bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity
  FROM deliveries d
  LEFT JOIN orders o ON d.order_id = o.id
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN profiles p ON d.delivered_by = p.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;

-- Actualizar constraints en la tabla deliveries para incluir los status correctos
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.deliveries ADD CONSTRAINT deliveries_status_check 
CHECK (status IN ('pending', 'in_transit', 'delivered', 'in_quality', 'approved', 'rejected', 'returned'));

-- Actualizar constraints en la tabla delivery_items para quality_status
ALTER TABLE public.delivery_items DROP CONSTRAINT IF EXISTS delivery_items_quality_status_check;
ALTER TABLE public.delivery_items ADD CONSTRAINT delivery_items_quality_status_check 
CHECK (quality_status IN ('pending', 'approved', 'rejected', 'rework_needed'));

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_workshop_id ON public.deliveries(workshop_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON public.deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_order_item_id ON public.delivery_items(order_item_id);

-- Trigger para actualizar el updated_at en deliveries
CREATE OR REPLACE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para actualizar el estado de la orden basado en las entregas
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar si todas las entregas de esta orden están aprobadas
  IF (SELECT COUNT(*) FROM deliveries WHERE order_id = NEW.order_id AND status != 'approved') = 0 THEN
    -- Si todas las entregas están aprobadas, marcar la orden como completada
    UPDATE orders SET status = 'completed' WHERE id = NEW.order_id;
  ELSIF NEW.status = 'in_quality' THEN
    -- Si hay entregas en calidad, marcar la orden como en progreso
    UPDATE orders SET status = 'in_progress' WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para actualizar el estado de la orden cuando cambia el estado de una entrega
CREATE OR REPLACE TRIGGER update_order_status_on_delivery_change
  AFTER UPDATE OF status ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_from_deliveries();
