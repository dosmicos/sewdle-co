
-- Agregar funciones para calcular estadísticas de órdenes
CREATE OR REPLACE FUNCTION public.get_order_delivery_stats(order_id_param UUID)
RETURNS TABLE (
  total_ordered INTEGER,
  total_delivered INTEGER,
  total_approved INTEGER,
  total_defective INTEGER,
  total_pending INTEGER,
  completion_percentage NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    -- Total ordenado (suma de cantidades en order_items)
    COALESCE(SUM(oi.quantity), 0)::INTEGER as total_ordered,
    
    -- Total entregado (suma de cantidades entregadas)
    COALESCE(SUM(di.quantity_delivered), 0)::INTEGER as total_delivered,
    
    -- Total aprobado (suma de cantidades con calidad aprobada)
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'approved' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          -- Extraer cantidad aprobada de las notas
          COALESCE(
            (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
            0
          )
        ELSE 0
      END
    ), 0)::INTEGER as total_approved,
    
    -- Total defectuoso (suma de cantidades rechazadas o defectuosas)
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'rejected' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          -- Extraer cantidad defectuosa de las notas
          COALESCE(
            (regexp_match(di.notes, 'Defectuosas: (\d+)'))[1]::INTEGER, 
            0
          )
        ELSE 0
      END
    ), 0)::INTEGER as total_defective,
    
    -- Total pendiente (ordenado - aprobado)
    GREATEST(0, 
      COALESCE(SUM(oi.quantity), 0) - 
      COALESCE(SUM(
        CASE 
          WHEN di.quality_status = 'approved' THEN di.quantity_delivered
          WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
            COALESCE(
              (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
              0
            )
          ELSE 0
        END
      ), 0)
    )::INTEGER as total_pending,
    
    -- Porcentaje de completitud
    CASE 
      WHEN COALESCE(SUM(oi.quantity), 0) = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(
          CASE 
            WHEN di.quality_status = 'approved' THEN di.quantity_delivered
            WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
              COALESCE(
                (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
                0
              )
            ELSE 0
          END
        ), 0)::NUMERIC / SUM(oi.quantity)::NUMERIC) * 100, 
        2
      )
    END as completion_percentage
    
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN delivery_items di ON oi.id = di.order_item_id
  LEFT JOIN deliveries d ON di.delivery_id = d.id
  WHERE o.id = order_id_param
  GROUP BY o.id;
$$;

-- Función para obtener estadísticas detalladas por entrega de una orden
CREATE OR REPLACE FUNCTION public.get_order_deliveries_breakdown(order_id_param UUID)
RETURNS TABLE (
  delivery_id UUID,
  tracking_number TEXT,
  delivery_date DATE,
  delivery_status TEXT,
  workshop_name TEXT,
  items_delivered INTEGER,
  items_approved INTEGER,
  items_defective INTEGER,
  delivery_notes TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.delivery_date,
    d.status as delivery_status,
    w.name as workshop_name,
    
    -- Items entregados en esta entrega
    COALESCE(SUM(di.quantity_delivered), 0)::INTEGER as items_delivered,
    
    -- Items aprobados en esta entrega
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'approved' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          COALESCE(
            (regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
            0
          )
        ELSE 0
      END
    ), 0)::INTEGER as items_approved,
    
    -- Items defectuosos en esta entrega
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'rejected' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          COALESCE(
            (regexp_match(di.notes, 'Defectuosas: (\d+)'))[1]::INTEGER, 
            0
          )
        ELSE 0
      END
    ), 0)::INTEGER as items_defective,
    
    d.notes as delivery_notes
    
  FROM deliveries d
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  WHERE d.order_id = order_id_param
  GROUP BY d.id, d.tracking_number, d.delivery_date, d.status, w.name, d.notes
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$$;

-- Trigger para actualizar automáticamente el estado de las órdenes basado en entregas
CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  order_stats RECORD;
BEGIN
  -- Obtener estadísticas de la orden
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats(NEW.order_id);
  
  -- Actualizar estado de la orden basado en las estadísticas
  UPDATE orders 
  SET status = CASE 
    WHEN order_stats.total_approved >= order_stats.total_ordered THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE status -- Mantener estado actual si no hay entregas
  END,
  updated_at = now()
  WHERE id = NEW.order_id;
  
  RETURN NEW;
END;
$$;

-- Crear trigger para actualizar estado de orden cuando se procesa calidad
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;
CREATE TRIGGER trigger_update_order_completion
  AFTER UPDATE ON public.delivery_items
  FOR EACH ROW
  WHEN (OLD.quality_status IS DISTINCT FROM NEW.quality_status)
  EXECUTE FUNCTION public.update_order_completion_status();
