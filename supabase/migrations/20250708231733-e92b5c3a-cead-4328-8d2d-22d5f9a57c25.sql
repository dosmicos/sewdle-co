-- Corregir la función update_order_completion_status_v2() para acceder correctamente al ID de entrega
CREATE OR REPLACE FUNCTION public.update_order_completion_status_v2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_order_id UUID;
  order_stats RECORD;
  old_order_status TEXT;
  new_order_status TEXT;
BEGIN
  -- Obtener el order_id desde la tabla deliveries
  -- CORRECCIÓN: usar NEW.id en lugar de NEW.delivery_id porque este trigger se ejecuta en deliveries
  SELECT d.order_id INTO delivery_order_id
  FROM deliveries d
  WHERE d.id = COALESCE(NEW.id, OLD.id);
  
  -- Si no se encuentra el order_id, retornar sin hacer nada
  IF delivery_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Obtener el estado actual de la orden ANTES de actualizarlo
  SELECT status INTO old_order_status
  FROM orders
  WHERE id = delivery_order_id;
  
  -- Obtener estadísticas de la orden usando la nueva función
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats_v2(delivery_order_id);
  
  -- Determinar el nuevo estado de la orden
  new_order_status := CASE 
    -- 1. Si no hay entregas, mantener como pendiente
    WHEN order_stats.total_delivered = 0 THEN 'pending'
    
    -- 2. Si no hay unidades pendientes (todas las ordenadas están aprobadas), completada
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    
    -- 3. Si hay entregas pero aún hay unidades pendientes (incluye devueltas), en proceso
    WHEN order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN 'in_progress'
    
    -- 4. Mantener estado actual para casos edge
    ELSE old_order_status
  END;
  
  -- Actualizar estado de la orden
  UPDATE orders 
  SET status = new_order_status,
      updated_at = now()
  WHERE id = delivery_order_id
  -- No cambiar órdenes que están canceladas manualmente
  AND status != 'cancelled';
  
  -- NUEVA FUNCIONALIDAD: Si la orden cambió a 'completed', actualizar entregas parcialmente aprobadas
  IF old_order_status != 'completed' AND new_order_status = 'completed' THEN
    UPDATE deliveries 
    SET status = 'approved',
        notes = CASE 
          WHEN notes IS NOT NULL AND notes != '' THEN 
            notes || ' [Actualizado automáticamente: Orden completada - Estado cambiado de parcial a aprobado]'
          ELSE 
            'Actualizado automáticamente: Orden completada - Estado cambiado de parcial a aprobado'
        END,
        updated_at = now()
    WHERE order_id = delivery_order_id 
    AND status = 'partial_approved';
    
    -- Log para debugging
    RAISE NOTICE 'Orden % completada: actualizadas % entregas de parcial_approved a approved', 
      delivery_order_id, 
      (SELECT COUNT(*) FROM deliveries WHERE order_id = delivery_order_id AND status = 'approved');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;