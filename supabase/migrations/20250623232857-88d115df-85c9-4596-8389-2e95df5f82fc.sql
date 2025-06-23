
-- Corregir la función consume_order_materials para asociar consumos con órdenes
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
BEGIN
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
      
      -- CORRECCIÓN: Crear un nuevo registro de consumo asociado a la orden
      -- En lugar de modificar el registro de entrega original, creamos uno nuevo
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
        workshop_id,
        order_id_param, -- AQUÍ está la corrección clave: asociar con la orden
        0, -- No es una entrega, es un consumo
        consume_from_delivery, -- Cantidad consumida
        0, -- Ya no queda nada disponible de este consumo
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
      
      RAISE NOTICE 'Consumido % de entrega % para material % asociado a orden %', 
        consume_from_delivery, delivery_record.id, material_uuid, order_id_param;
    END LOOP;
    
    -- Si no se pudo consumir todo, lanzar error
    IF remaining_to_consume > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para material %. Faltaron % unidades.', 
        material_uuid, remaining_to_consume;
    END IF;
  END LOOP;
END;
$$;
