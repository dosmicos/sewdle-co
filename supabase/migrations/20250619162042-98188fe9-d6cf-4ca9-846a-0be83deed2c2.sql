
-- Corregir la función del trigger para manejar correctamente las actualizaciones de delivery_items
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
    WHEN order_stats.total_approved >= order_stats.total_ordered THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE status -- Mantener estado actual si no hay entregas
  END,
  updated_at = now()
  WHERE id = delivery_order_id;
  
  RETURN NEW;
END;
$$;
