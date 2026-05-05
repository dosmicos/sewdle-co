
-- Eliminar el trigger existente y recrearlo correctamente
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;

-- Recrear la función del trigger con mejor lógica
CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_stats RECORD;
  delivery_order_id UUID;
BEGIN
  -- Obtener el order_id desde la tabla deliveries
  SELECT d.order_id INTO delivery_order_id
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;
  
  -- Si no se encuentra el order_id, retornar sin hacer nada
  IF delivery_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Obtener estadísticas de la orden
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats(delivery_order_id);
  
  -- Actualizar estado de la orden basado en las estadísticas
  UPDATE orders 
  SET status = CASE 
    WHEN order_stats.total_approved >= order_stats.total_ordered AND order_stats.total_pending = 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE status -- Mantener estado actual si no hay entregas
  END,
  updated_at = now()
  WHERE id = delivery_order_id;
  
  RETURN NEW;
END;
$$;

-- Recrear el trigger para que se active en INSERT y UPDATE
CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();

-- Ejecutar manualmente la actualización para la orden ORD-0009
DO $$
DECLARE
  order_record RECORD;
  order_stats RECORD;
BEGIN
  -- Buscar la orden ORD-0009
  SELECT id INTO order_record
  FROM orders 
  WHERE order_number = 'ORD-0009';
  
  IF order_record.id IS NOT NULL THEN
    -- Obtener estadísticas actuales
    SELECT * INTO order_stats 
    FROM public.get_order_delivery_stats(order_record.id);
    
    -- Actualizar el estado si corresponde
    UPDATE orders 
    SET status = CASE 
      WHEN order_stats.total_approved >= order_stats.total_ordered AND order_stats.total_pending = 0 THEN 'completed'
      WHEN order_stats.total_delivered > 0 THEN 'in_progress'
      ELSE status
    END,
    updated_at = now()
    WHERE id = order_record.id;
  END IF;
END $$;
