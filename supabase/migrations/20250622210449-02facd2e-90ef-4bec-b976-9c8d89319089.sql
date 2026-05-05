
-- Corregir la función de trigger para actualizar el estado de las entregas
CREATE OR REPLACE FUNCTION public.update_delivery_status_from_items_v2()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_stats RECORD;
  total_delivered INTEGER := 0;
  total_approved INTEGER := 0;
  total_defective INTEGER := 0;
  approval_rate NUMERIC := 0;
  new_status TEXT := 'pending';
  new_notes TEXT := '';
BEGIN
  -- Calcular estadísticas para esta entrega usando los nuevos campos
  SELECT 
    COALESCE(SUM(di.quantity_delivered), 0) as delivered,
    COALESCE(SUM(di.quantity_approved), 0) as approved,
    COALESCE(SUM(di.quantity_defective), 0) as defective
  INTO delivery_stats
  FROM delivery_items di
  WHERE di.delivery_id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  total_delivered := delivery_stats.delivered;
  total_approved := delivery_stats.approved;
  total_defective := delivery_stats.defective;
  
  -- Lógica corregida para estados de entregas:
  -- 1. Si no hay entregas aún, mantener como 'pending'
  IF total_delivered = 0 THEN
    new_status := 'pending';
    new_notes := 'Entrega pendiente: no hay items entregados';
  -- 2. Si hay entregas pero no se ha revisado calidad (aprobadas + defectuosas = 0)
  ELSIF total_delivered > 0 AND (total_approved + total_defective) = 0 THEN
    new_status := 'in_quality';
    new_notes := format('En revisión de calidad: %s items entregados pendientes de revisar', total_delivered);
  -- 3. Si todas las unidades están revisadas
  ELSIF (total_approved + total_defective) = total_delivered THEN
    -- 3a. Si no hay defectuosas, está totalmente aprobada
    IF total_defective = 0 THEN
      new_status := 'approved';
      new_notes := format('Entrega aprobada: %s/%s items aprobados', total_approved, total_delivered);
    -- 3b. Si todas son defectuosas, está rechazada
    ELSIF total_approved = 0 THEN
      new_status := 'rejected';
      new_notes := format('Entrega rechazada: %s/%s items defectuosos', total_defective, total_delivered);
    -- 3c. Si hay mezcla, parcialmente aprobada
    ELSE
      new_status := 'partial_approved';
      approval_rate := (total_approved::NUMERIC / total_delivered::NUMERIC) * 100;
      new_notes := format('Entrega parcial: %s aprobados, %s defectuosos de %s entregados (%s%% aprobación)', 
        total_approved, total_defective, total_delivered, ROUND(approval_rate, 1));
    END IF;
  -- 4. Si hay entregas pero faltan items por revisar
  ELSIF (total_approved + total_defective) < total_delivered THEN
    new_status := 'in_quality';
    new_notes := format('En revisión: %s aprobados, %s defectuosos, %s pendientes de revisar de %s entregados', 
      total_approved, total_defective, (total_delivered - total_approved - total_defective), total_delivered);
  ELSE
    -- Caso edge, mantener estado actual
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
$function$;

-- Corregir la función de trigger para actualizar el estado de las órdenes
CREATE OR REPLACE FUNCTION public.update_order_completion_status_v2()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
  
  -- Obtener estadísticas de la orden usando la nueva función
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats_v2(delivery_order_id);
  
  -- Lógica corregida para estados de órdenes:
  UPDATE orders 
  SET status = CASE 
    -- 1. Si no hay entregas, mantener como pendiente
    WHEN order_stats.total_delivered = 0 THEN 'pending'
    
    -- 2. Si no hay unidades pendientes (todas las ordenadas están aprobadas), completada
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    
    -- 3. Si hay entregas pero aún hay unidades pendientes (incluye devueltas), en proceso
    WHEN order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN 'in_progress'
    
    -- 4. Mantener estado actual para casos edge
    ELSE status
  END,
  updated_at = now()
  WHERE id = delivery_order_id
  -- No cambiar órdenes que están canceladas manualmente
  AND status != 'cancelled';
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recrear los triggers con las funciones corregidas
DROP TRIGGER IF EXISTS update_delivery_status_trigger ON delivery_items;
DROP TRIGGER IF EXISTS update_order_status_trigger ON delivery_items;

CREATE TRIGGER update_delivery_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_status_from_items_v2();

CREATE TRIGGER update_order_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_completion_status_v2();

-- Ejecutar una actualización manual para corregir estados existentes
DO $$
DECLARE
  delivery_record RECORD;
  order_record RECORD;
  delivery_stats RECORD;
  order_stats RECORD;
  new_delivery_status TEXT;
  new_order_status TEXT;
BEGIN
  -- Corregir estados de entregas existentes
  FOR delivery_record IN 
    SELECT DISTINCT d.id, d.status 
    FROM deliveries d 
    INNER JOIN delivery_items di ON d.id = di.delivery_id
  LOOP
    -- Calcular estadísticas para esta entrega
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as delivered,
      COALESCE(SUM(di.quantity_approved), 0) as approved,
      COALESCE(SUM(di.quantity_defective), 0) as defective
    INTO delivery_stats
    FROM delivery_items di
    WHERE di.delivery_id = delivery_record.id;
    
    -- Aplicar la misma lógica de estado
    IF delivery_stats.delivered = 0 THEN
      new_delivery_status := 'pending';
    ELSIF delivery_stats.delivered > 0 AND (delivery_stats.approved + delivery_stats.defective) = 0 THEN
      new_delivery_status := 'in_quality';
    ELSIF (delivery_stats.approved + delivery_stats.defective) = delivery_stats.delivered THEN
      IF delivery_stats.defective = 0 THEN
        new_delivery_status := 'approved';
      ELSIF delivery_stats.approved = 0 THEN
        new_delivery_status := 'rejected';
      ELSE
        new_delivery_status := 'partial_approved';
      END IF;
    ELSIF (delivery_stats.approved + delivery_stats.defective) < delivery_stats.delivered THEN
      new_delivery_status := 'in_quality';
    ELSE
      new_delivery_status := delivery_record.status;
    END IF;
    
    -- Actualizar solo si el estado cambió
    IF new_delivery_status != delivery_record.status THEN
      UPDATE deliveries 
      SET status = new_delivery_status, updated_at = now()
      WHERE id = delivery_record.id;
    END IF;
  END LOOP;
  
  -- Corregir estados de órdenes existentes
  FOR order_record IN 
    SELECT DISTINCT o.id, o.status 
    FROM orders o 
    INNER JOIN deliveries d ON o.id = d.order_id
    WHERE o.status != 'cancelled'
  LOOP
    SELECT * INTO order_stats FROM public.get_order_delivery_stats_v2(order_record.id);
    
    -- Aplicar la misma lógica de estado
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
