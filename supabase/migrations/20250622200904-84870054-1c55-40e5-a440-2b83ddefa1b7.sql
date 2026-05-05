
-- Fase 1: Reestructurar la tabla delivery_items
-- Agregar campos dedicados para cantidades aprobadas y defectuosas

ALTER TABLE public.delivery_items 
ADD COLUMN quantity_approved INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN quantity_defective INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN quality_notes TEXT;

-- Migrar datos existentes desde las notas a los nuevos campos
-- Extraer cantidades aprobadas y defectuosas de las notas existentes
UPDATE public.delivery_items 
SET 
  quantity_approved = COALESCE(
    (regexp_match(notes, 'Aprobadas: (\d+)'))[1]::INTEGER, 
    CASE 
      WHEN quality_status = 'approved' THEN quantity_delivered
      ELSE 0
    END
  ),
  quantity_defective = COALESCE(
    (regexp_match(notes, 'Defectuosas: (\d+)'))[1]::INTEGER,
    CASE 
      WHEN quality_status = 'rejected' THEN quantity_delivered
      ELSE 0
    END
  ),
  quality_notes = CASE 
    WHEN notes IS NOT NULL AND notes != '' THEN 
      regexp_replace(
        regexp_replace(notes, 'Aprobadas: \d+[,.]?\s*', '', 'gi'),
        'Defectuosas: \d+[,.]?\s*', '', 'gi'
      )
    ELSE NULL
  END
WHERE notes IS NOT NULL OR quality_status IN ('approved', 'rejected');

-- Crear función mejorada para actualizar el estado de las entregas basada en los nuevos campos
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
  
  -- Aplicar nueva lógica de estados simplificada
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
  ELSIF total_approved > 0 AND total_defective = 0 AND total_approved < total_delivered THEN
    -- Caso especial: hay aprobadas pero faltan por revisar
    new_status := 'in_quality';
    new_notes := format('En revisión: %s aprobadas de %s entregadas', total_approved, total_delivered);
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
$function$;

-- Reemplazar el trigger existente con la nueva función
DROP TRIGGER IF EXISTS update_delivery_status_trigger ON delivery_items;
CREATE TRIGGER update_delivery_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_status_from_items_v2();

-- Crear función mejorada para obtener estadísticas de entregas
CREATE OR REPLACE FUNCTION public.get_deliveries_with_details_v2()
RETURNS TABLE(
  id uuid, 
  tracking_number text, 
  order_id uuid, 
  order_number text, 
  workshop_id uuid, 
  workshop_name text, 
  delivery_date date, 
  status text, 
  delivered_by uuid, 
  delivered_by_name text, 
  recipient_name text, 
  recipient_phone text, 
  recipient_address text, 
  notes text, 
  created_at timestamp with time zone, 
  items_count bigint, 
  total_quantity bigint,
  total_approved bigint,
  total_defective bigint
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) as total_approved,
    COALESCE(SUM(di.quantity_defective), 0) as total_defective
  FROM deliveries d
  LEFT JOIN orders o ON d.order_id = o.id
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN profiles p ON d.delivered_by = p.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

-- Actualizar la función de estadísticas de órdenes para usar los nuevos campos
CREATE OR REPLACE FUNCTION public.get_order_delivery_stats_v2(order_id_param uuid)
RETURNS TABLE(
  total_ordered integer, 
  total_delivered integer, 
  total_approved integer, 
  total_defective integer, 
  total_pending integer, 
  completion_percentage numeric
)
LANGUAGE sql
STABLE
AS $function$
  WITH order_totals AS (
    SELECT 
      COALESCE(SUM(oi.quantity), 0) as total_ordered_qty
    FROM order_items oi
    WHERE oi.order_id = order_id_param
  ),
  delivery_stats AS (
    SELECT 
      COALESCE(SUM(di.quantity_delivered), 0) as total_delivered_qty,
      COALESCE(SUM(di.quantity_approved), 0) as total_approved_qty,
      COALESCE(SUM(di.quantity_defective), 0) as total_defective_qty
    FROM delivery_items di
    INNER JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_id_param
  )
  SELECT 
    ot.total_ordered_qty::INTEGER as total_ordered,
    ds.total_delivered_qty::INTEGER as total_delivered,
    ds.total_approved_qty::INTEGER as total_approved,
    ds.total_defective_qty::INTEGER as total_defective,
    GREATEST(0, ot.total_ordered_qty - ds.total_approved_qty)::INTEGER as total_pending,
    CASE 
      WHEN ot.total_ordered_qty = 0 THEN 0
      ELSE ROUND((ds.total_approved_qty::NUMERIC / ot.total_ordered_qty::NUMERIC) * 100, 2)
    END as completion_percentage
  FROM order_totals ot
  CROSS JOIN delivery_stats ds;
$function$;

-- Actualizar trigger de actualización de estado de órdenes para usar la nueva función
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
  
  -- Actualizar estado de la orden
  UPDATE orders 
  SET status = CASE 
    WHEN order_stats.total_delivered = 0 THEN 'pending'
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN 'in_progress'
    ELSE status
  END,
  updated_at = now()
  WHERE id = delivery_order_id
  AND status != 'cancelled';
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Reemplazar el trigger de actualización de órdenes
DROP TRIGGER IF EXISTS update_order_status_trigger ON delivery_items;
CREATE TRIGGER update_order_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_completion_status_v2();
