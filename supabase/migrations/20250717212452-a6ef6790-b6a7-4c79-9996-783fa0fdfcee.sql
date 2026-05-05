-- Fix workshop assignment in material consumption records
CREATE OR REPLACE FUNCTION public.consume_order_materials(
  order_id_param uuid,
  consumption_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  consumption_item jsonb;
  material_uuid uuid;
  quantity_to_consume integer;
  delivery_record RECORD;
  remaining_to_consume integer;
  consume_from_delivery integer;
  workshop_id_record uuid;
BEGIN
  -- Get workshop ID from order assignment
  SELECT workshop_id INTO workshop_id_record
  FROM workshop_assignments 
  WHERE order_id = order_id_param 
  AND status = 'assigned'
  LIMIT 1;
  
  -- If no workshop assignment found, raise error
  IF workshop_id_record IS NULL THEN
    RAISE EXCEPTION 'La orden no está asignada a ningún taller.';
  END IF;
  
  -- Iterar sobre cada material a consumir
  FOR consumption_item IN SELECT * FROM jsonb_array_elements(consumption_data) LOOP
    material_uuid := (consumption_item->>'material_id')::uuid;
    quantity_to_consume := (consumption_item->>'quantity')::integer;
    remaining_to_consume := quantity_to_consume;
    
    -- Consumir de las entregas más antiguas primero (FIFO)
    FOR delivery_record IN 
      SELECT id, quantity_remaining 
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
      
      -- Crear un nuevo registro de consumo asociado a la orden Y al taller asignado
      INSERT INTO public.material_deliveries (
        material_id,
        workshop_id,
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
        workshop_id_record, -- Usar el workshop de la asignación
        order_id_param,
        0,
        consume_from_delivery,
        0,
        CURRENT_DATE,
        delivered_by,
        'Consumo para orden ' || (SELECT order_number FROM orders WHERE id = order_id_param),
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
      RAISE EXCEPTION 'Stock insuficiente para material %. Faltaron % unidades.', 
        material_uuid, remaining_to_consume;
    END IF;
  END LOOP;
END;
$$;