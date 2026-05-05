-- Update materials table to allow decimal quantities
ALTER TABLE public.materials 
ALTER COLUMN current_stock TYPE numeric USING current_stock::numeric,
ALTER COLUMN min_stock_alert TYPE numeric USING min_stock_alert::numeric;

-- Update order_supplies table to allow decimal quantities
ALTER TABLE public.order_supplies 
ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

-- Update consume_order_materials function to handle decimal quantities
CREATE OR REPLACE FUNCTION public.consume_order_materials(order_id_param uuid, consumption_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  consumption_item jsonb;
  material_uuid uuid;
  quantity_to_consume numeric;
  delivery_record RECORD;
  remaining_to_consume numeric;
  consume_from_delivery numeric;
  workshop_id_record uuid;
BEGIN
  -- Get workshop ID from order assignment - CRITICAL FIX
  SELECT workshop_id INTO workshop_id_record
  FROM workshop_assignments 
  WHERE order_id = order_id_param 
  AND status IN ('assigned', 'in_progress', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no workshop assignment found, raise error
  IF workshop_id_record IS NULL THEN
    RAISE EXCEPTION 'La orden % no está asignada a ningún taller o no tiene asignación activa.', order_id_param;
  END IF;
  
  -- Iterar sobre cada material a consumir
  FOR consumption_item IN SELECT * FROM jsonb_array_elements(consumption_data) LOOP
    material_uuid := (consumption_item->>'material_id')::uuid;
    quantity_to_consume := (consumption_item->>'quantity')::numeric;
    remaining_to_consume := quantity_to_consume;
    
    -- Consumir de las entregas más antiguas primero (FIFO)
    -- IMPORTANT: Only consume from deliveries that belong to ANY workshop, not just the assigned one
    FOR delivery_record IN 
      SELECT id, quantity_remaining, workshop_id
      FROM public.material_deliveries 
      WHERE material_id = material_uuid 
        AND quantity_remaining > 0 
      ORDER BY delivery_date ASC, created_at ASC
    LOOP
      IF remaining_to_consume <= 0 THEN
        EXIT;
      END IF;
      
      -- Determinar cuánto consumir de esta entrega
      consume_from_delivery := LEAST(delivery_record.quantity_remaining, remaining_to_consume);
      
      -- Crear un nuevo registro de consumo asociado a la orden Y al taller CORRECTO de la asignación
      INSERT INTO public.material_deliveries (
        material_id,
        workshop_id,           -- USAR EL WORKSHOP DE LA ASIGNACIÓN, NO EL DE LA ENTREGA
        order_id,
        quantity_delivered,
        quantity_consumed,
        quantity_remaining,
        delivery_date,
        delivered_by,
        notes,
        created_at,
        updated_at
      )
      SELECT 
        material_id,
        workshop_id_record,    -- CRITICAL FIX: usar workshop de la asignación
        order_id_param,
        0,
        consume_from_delivery,
        0,
        CURRENT_DATE,
        delivered_by,
        format('Consumo para orden %s (Taller: %s)', 
          (SELECT order_number FROM orders WHERE id = order_id_param),
          (SELECT name FROM workshops WHERE id = workshop_id_record)
        ),
        now(),
        now()
      FROM public.material_deliveries 
      WHERE id = delivery_record.id;
      
      -- Actualizar la entrega original reduciendo la cantidad disponible
      UPDATE public.material_deliveries 
      SET quantity_remaining = quantity_remaining - consume_from_delivery,
          updated_at = now()
      WHERE id = delivery_record.id;
      
      remaining_to_consume := remaining_to_consume - consume_from_delivery;
      
      RAISE NOTICE 'Consumido % de entrega % para material % asociado a orden % y taller %', 
        consume_from_delivery, delivery_record.id, material_uuid, order_id_param, workshop_id_record;
    END LOOP;
    
    -- Si no se pudo consumir todo, lanzar error
    IF remaining_to_consume > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para material %. Faltan % unidades por consumir.', 
        material_uuid, remaining_to_consume;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Consumo completado para orden % en taller %', order_id_param, workshop_id_record;
END;
$function$;