
-- Eliminar el trigger actual
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;

-- Crear una función más simple para el trigger
CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  delivery_order_id UUID;
  order_stats RECORD;
BEGIN
  -- Obtener el order_id desde la tabla deliveries
  SELECT d.order_id INTO delivery_order_id
  FROM deliveries d
  WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  -- Si no se encuentra el order_id, retornar sin hacer nada
  IF delivery_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Obtener estadísticas de la orden
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats(delivery_order_id);
  
  -- Actualizar estado de la orden a completado si no hay unidades pendientes
  IF order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN
    UPDATE orders 
    SET status = 'completed',
        updated_at = now()
    WHERE id = delivery_order_id;
  ELSIF order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN
    UPDATE orders 
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = delivery_order_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear el trigger
CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();

-- Ejecutar manualmente para órdenes existentes que deberían estar completadas
-- Primero crear una función temporal para ayudar con la actualización
CREATE OR REPLACE FUNCTION temp_update_completed_orders()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  order_record RECORD;
  order_stats RECORD;
BEGIN
  FOR order_record IN SELECT id FROM orders WHERE status != 'completed' LOOP
    SELECT * INTO order_stats FROM public.get_order_delivery_stats(order_record.id);
    
    IF order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN
      UPDATE orders 
      SET status = 'completed', updated_at = now()
      WHERE id = order_record.id;
    END IF;
  END LOOP;
END;
$$;

-- Ejecutar la función temporal
SELECT temp_update_completed_orders();

-- Eliminar la función temporal
DROP FUNCTION temp_update_completed_orders();
