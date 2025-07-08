-- Corregir la función del trigger para manejar correctamente los campos de delivery_items
CREATE OR REPLACE FUNCTION public.update_delivery_status_from_items_v2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_stats RECORD;
  target_delivery_id UUID;
  total_delivered INTEGER := 0;
  total_approved INTEGER := 0;
  total_defective INTEGER := 0;
  approval_rate NUMERIC := 0;
  new_status TEXT := 'pending';
  new_notes TEXT := '';
BEGIN
  -- Obtener el delivery_id correcto del trigger
  target_delivery_id := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF target_delivery_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calcular estadísticas para esta entrega usando los nuevos campos
  SELECT 
    COALESCE(SUM(di.quantity_delivered), 0) as delivered,
    COALESCE(SUM(di.quantity_approved), 0) as approved,
    COALESCE(SUM(di.quantity_defective), 0) as defective
  INTO delivery_stats
  FROM delivery_items di
  WHERE di.delivery_id = target_delivery_id;
  
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
  WHERE id = target_delivery_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;