-- Actualizar el trigger para usar lógica correcta de unidades
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  order_uuid UUID;
BEGIN
  -- Obtener el order_id del trigger
  order_uuid := COALESCE(NEW.order_id, OLD.order_id);
  
  IF order_uuid IS NULL THEN
    -- Si es un delivery_item, obtener order_id desde deliveries
    SELECT d.order_id INTO order_uuid
    FROM public.deliveries d
    WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  END IF;
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calcular total ordenado
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM public.order_items 
  WHERE order_id = order_uuid;
  
  -- Calcular total aprobado
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM public.delivery_items di
  JOIN public.deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid;
  
  -- Actualizar estado según unidades
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = order_uuid;
  ELSIF EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = order_uuid AND status IN ('in_quality', 'pending')) THEN
    UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = order_uuid;
  ELSIF EXISTS (SELECT 1 FROM public.workshop_assignments WHERE order_id = order_uuid AND status IN ('assigned', 'in_progress')) THEN
    UPDATE public.orders SET status = 'assigned', updated_at = now() WHERE id = order_uuid;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Corregir todas las órdenes existentes según sus unidades reales
UPDATE public.orders 
SET status = CASE
  -- Si todas las unidades están aprobadas -> completada
  WHEN (
    SELECT COALESCE(SUM(oi.quantity), 0) 
    FROM public.order_items oi 
    WHERE oi.order_id = orders.id
  ) <= (
    SELECT COALESCE(SUM(di.quantity_approved), 0)
    FROM public.delivery_items di
    JOIN public.deliveries d ON di.delivery_id = d.id  
    WHERE d.order_id = orders.id
  ) AND (
    SELECT COALESCE(SUM(oi.quantity), 0) 
    FROM public.order_items oi 
    WHERE oi.order_id = orders.id
  ) > 0 THEN 'completed'
  
  -- Si tiene entregas en proceso -> en progreso
  WHEN EXISTS (
    SELECT 1 FROM public.deliveries 
    WHERE order_id = orders.id 
    AND status IN ('in_quality', 'pending')
  ) THEN 'in_progress'
  
  -- Si tiene asignaciones activas -> asignada
  WHEN EXISTS (
    SELECT 1 FROM public.workshop_assignments 
    WHERE order_id = orders.id 
    AND status IN ('assigned', 'in_progress')
  ) THEN 'assigned'
  
  -- Mantener estado actual para el resto
  ELSE status
END,
updated_at = now()
WHERE status != 'completed' OR EXISTS (
  SELECT 1 FROM public.deliveries WHERE order_id = orders.id
);