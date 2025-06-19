
-- Mejorar la función del trigger para actualizar estados de entregas cuando la orden se completa
CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_stats RECORD;
  delivery_order_id UUID;
  old_order_status TEXT;
  new_order_status TEXT;
BEGIN
  -- Obtener el order_id desde la tabla deliveries
  SELECT d.order_id INTO delivery_order_id
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;
  
  -- Si no se encuentra el order_id, retornar sin hacer nada
  IF delivery_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Obtener el estado actual de la orden
  SELECT status INTO old_order_status
  FROM orders
  WHERE id = delivery_order_id;
  
  -- Obtener estadísticas de la orden
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats(delivery_order_id);
  
  -- Determinar el nuevo estado de la orden
  new_order_status := CASE 
    WHEN order_stats.total_approved >= order_stats.total_ordered AND order_stats.total_pending = 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE old_order_status -- Mantener estado actual si no hay entregas
  END;
  
  -- Actualizar estado de la orden
  UPDATE orders 
  SET status = new_order_status,
      updated_at = now()
  WHERE id = delivery_order_id;
  
  -- Si la orden cambió a 'completed', actualizar todas las entregas parcialmente aprobadas a aprobadas
  IF old_order_status != 'completed' AND new_order_status = 'completed' THEN
    UPDATE delivery_items 
    SET quality_status = 'approved',
        notes = CASE 
          WHEN notes IS NOT NULL THEN notes || ' [Actualizado automáticamente: Orden completada]'
          ELSE '[Actualizado automáticamente: Orden completada]'
        END
    WHERE delivery_id IN (
      SELECT d.id 
      FROM deliveries d 
      WHERE d.order_id = delivery_order_id
    ) 
    AND quality_status = 'partial_approved';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Ejecutar manualmente la actualización para órdenes ya completadas que tengan entregas parcialmente aprobadas
DO $$
DECLARE
  order_record RECORD;
BEGIN
  -- Buscar órdenes completadas con entregas parcialmente aprobadas
  FOR order_record IN 
    SELECT DISTINCT o.id, o.order_number
    FROM orders o
    INNER JOIN deliveries d ON o.id = d.order_id
    INNER JOIN delivery_items di ON d.id = di.delivery_id
    WHERE o.status = 'completed' 
    AND di.quality_status = 'partial_approved'
  LOOP
    -- Actualizar las entregas parcialmente aprobadas a aprobadas
    UPDATE delivery_items 
    SET quality_status = 'approved',
        notes = CASE 
          WHEN notes IS NOT NULL THEN notes || ' [Actualizado automáticamente: Orden completada]'
          ELSE '[Actualizado automáticamente: Orden completada]'
        END
    WHERE delivery_id IN (
      SELECT d.id 
      FROM deliveries d 
      WHERE d.order_id = order_record.id
    ) 
    AND quality_status = 'partial_approved';
    
  END LOOP;
END $$;
