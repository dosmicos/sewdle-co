
-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;

-- Recrear la función para actualizar el estado de las órdenes
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
  
  -- Actualizar estado de la orden según la nueva lógica:
  -- 1. Pendiente: Cuando no se ha creado ninguna entrega de la orden
  -- 2. En proceso: Cuando ya hay entregas pero hay unidades pendientes
  -- 3. Completada: Cuando NO hay unidades pendientes
  -- 4. Cancelada: Solo se hace de manera manual (no tocamos este estado)
  
  UPDATE orders 
  SET status = CASE 
    -- Si no hay entregas, mantener como pendiente
    WHEN order_stats.total_delivered = 0 THEN 'pending'
    -- Si no hay unidades pendientes, marcar como completada
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    -- Si hay entregas pero aún hay unidades pendientes, marcar como en proceso
    WHEN order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN 'in_progress'
    -- Mantener estado actual para casos edge
    ELSE status
  END,
  updated_at = now()
  WHERE id = delivery_order_id
  -- No cambiar órdenes que están canceladas manualmente
  AND status != 'cancelled';
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recrear el trigger
CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();

-- Función auxiliar para actualizar estados de entregas basado en la nueva lógica
CREATE OR REPLACE FUNCTION public.update_delivery_status_from_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  delivery_stats RECORD;
  total_delivered INTEGER := 0;
  total_approved INTEGER := 0;
  total_defective INTEGER := 0;
  approval_rate NUMERIC := 0;
  new_status TEXT := 'pending';
  new_notes TEXT := '';
BEGIN
  -- Calcular estadísticas para esta entrega
  SELECT 
    COALESCE(SUM(di.quantity_delivered), 0) as delivered,
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'approved' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          COALESCE((regexp_match(di.notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 0)
        ELSE 0
      END
    ), 0) as approved,
    COALESCE(SUM(
      CASE 
        WHEN di.quality_status = 'rejected' THEN di.quantity_delivered
        WHEN di.quality_status = 'partial_approved' AND di.notes IS NOT NULL THEN
          COALESCE((regexp_match(di.notes, 'Defectuosas: (\d+)'))[1]::INTEGER, 0)
        ELSE 0
      END
    ), 0) as defective
  INTO delivery_stats
  FROM delivery_items di
  WHERE di.delivery_id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  total_delivered := delivery_stats.delivered;
  total_approved := delivery_stats.approved;
  total_defective := delivery_stats.defective;
  
  -- Aplicar nueva lógica de estados:
  IF total_defective = 0 AND total_approved = total_delivered AND total_delivered > 0 THEN
    -- Estado Aprobado: Si las unidades entregadas y las aprobadas son iguales y no hay defectuosas
    new_status := 'approved';
    new_notes := format('Entrega aprobada: %s aprobadas de %s entregadas', total_approved, total_delivered);
  ELSIF total_defective > 0 AND total_delivered > 0 THEN
    -- Calcular tasa de aprobación
    approval_rate := (total_approved::NUMERIC / total_delivered::NUMERIC) * 100;
    
    IF approval_rate > 50 THEN
      -- Parcialmente aprobado: Si hay unidades defectuosas y la tasa de aprobación es mayor al 50%
      new_status := 'partial_approved';
      new_notes := format('Entrega parcialmente aprobada: %s aprobadas, %s defectuosas de %s entregadas (%s%% aprobación)', 
        total_approved, total_defective, total_delivered, ROUND(approval_rate, 1));
    ELSE
      -- Devuelto: Si hay unidades defectuosas y la tasa de aprobación es menor o igual al 50%
      new_status := 'rejected';
      new_notes := format('Entrega devuelta: %s aprobadas, %s defectuosas de %s entregadas (%s%% aprobación)', 
        total_approved, total_defective, total_delivered, ROUND(approval_rate, 1));
    END IF;
  ELSE
    -- Mantener estado actual si no hay suficientes datos
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Actualizar el estado de la entrega
  UPDATE deliveries 
  SET status = new_status,
      notes = new_notes,
      updated_at = now()
  WHERE id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear trigger para actualizar estados de entregas
DROP TRIGGER IF EXISTS trigger_update_delivery_status ON public.delivery_items;
CREATE TRIGGER trigger_update_delivery_status
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_status_from_items();

-- Ejecutar actualización manual para órdenes existentes que necesiten corrección
DO $$
DECLARE
  order_record RECORD;
  order_stats RECORD;
  new_order_status TEXT;
BEGIN
  FOR order_record IN 
    SELECT id, status FROM orders 
    WHERE status IN ('completed', 'in_progress', 'pending') 
  LOOP
    SELECT * INTO order_stats FROM public.get_order_delivery_stats(order_record.id);
    
    -- Aplicar nueva lógica
    IF order_stats.total_delivered = 0 THEN
      new_order_status := 'pending';
    ELSIF order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN
      new_order_status := 'completed';
    ELSIF order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN
      new_order_status := 'in_progress';
    ELSE
      new_order_status := order_record.status;
    END IF;
    
    -- Actualizar solo si el estado cambió
    IF new_order_status != order_record.status THEN
      UPDATE orders 
      SET status = new_order_status, updated_at = now()
      WHERE id = order_record.id;
    END IF;
  END LOOP;
END $$;
