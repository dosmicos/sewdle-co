
-- Verificar si el trigger existe y está activo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_order_completion';

-- Verificar el estado específico de DEL-0012
SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.status as delivery_status,
    di.id as delivery_item_id,
    di.quality_status,
    di.quantity_delivered,
    di.notes,
    o.order_number,
    o.status as order_status
FROM deliveries d
INNER JOIN delivery_items di ON d.id = di.delivery_id
INNER JOIN orders o ON d.order_id = o.id
WHERE d.tracking_number = 'DEL-0012';

-- Actualizar específicamente DEL-0012 que sigue apareciendo como parcialmente aprobado
UPDATE delivery_items 
SET quality_status = 'approved',
    notes = COALESCE(notes, '') || ' [Corregido manualmente: ' || NOW()::timestamp || ']'
WHERE delivery_id = (SELECT id FROM deliveries WHERE tracking_number = 'DEL-0012')
AND quality_status = 'partial_approved';

-- Verificar después de la actualización
SELECT 
    d.tracking_number,
    d.status as delivery_status,
    di.quality_status,
    di.notes
FROM deliveries d
INNER JOIN delivery_items di ON d.id = di.delivery_id
WHERE d.tracking_number = 'DEL-0012';

-- Recrear el trigger con lógica mejorada
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;

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
  WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  -- Si no se encuentra el order_id, retornar sin hacer nada
  IF delivery_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
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
    ELSE old_order_status
  END;
  
  -- Actualizar estado de la orden solo si cambió
  IF old_order_status != new_order_status THEN
    UPDATE orders 
    SET status = new_order_status,
        updated_at = now()
    WHERE id = delivery_order_id;
    
    -- Si la orden cambió a 'completed', actualizar entregas parcialmente aprobadas
    IF new_order_status = 'completed' THEN
      UPDATE delivery_items 
      SET quality_status = 'approved',
          notes = CASE 
            WHEN notes IS NOT NULL AND notes NOT LIKE '%[Actualizado automáticamente: Orden completada]%' 
            THEN notes || ' [Actualizado automáticamente: Orden completada]'
            WHEN notes IS NULL 
            THEN '[Actualizado automáticamente: Orden completada]'
            ELSE notes
          END
      WHERE delivery_id IN (
        SELECT d.id 
        FROM deliveries d 
        WHERE d.order_id = delivery_order_id
      ) 
      AND quality_status = 'partial_approved';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear el trigger
CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();
