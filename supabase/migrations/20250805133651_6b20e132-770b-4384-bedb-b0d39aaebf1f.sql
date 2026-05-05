-- Fix data inconsistency and improve material consumption function
-- First, let's create a function to recalculate quantity_remaining for all material deliveries
CREATE OR REPLACE FUNCTION public.recalculate_material_deliveries_remaining()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_record RECORD;
  total_consumed_after numeric;
BEGIN
  -- Fix quantity_remaining for all delivery records
  FOR delivery_record IN 
    SELECT id, material_id, workshop_id, quantity_delivered, delivery_date, created_at
    FROM public.material_deliveries 
    WHERE quantity_delivered > 0
    ORDER BY material_id, workshop_id, delivery_date ASC, created_at ASC
  LOOP
    -- Calculate total consumed after this delivery date from this specific delivery
    SELECT COALESCE(SUM(md.quantity_consumed), 0) INTO total_consumed_after
    FROM public.material_deliveries md
    WHERE md.material_id = delivery_record.material_id 
      AND md.workshop_id = delivery_record.workshop_id
      AND md.quantity_consumed > 0
      AND (md.delivery_date > delivery_record.delivery_date 
           OR (md.delivery_date = delivery_record.delivery_date AND md.created_at > delivery_record.created_at));
    
    -- Update quantity_remaining for this delivery
    UPDATE public.material_deliveries 
    SET quantity_remaining = GREATEST(0, delivery_record.quantity_delivered - total_consumed_after),
        updated_at = now()
    WHERE id = delivery_record.id;
    
    RAISE NOTICE 'Updated delivery %: delivered=%, consumed_after=%, remaining=%', 
      delivery_record.id, delivery_record.quantity_delivered, total_consumed_after, 
      GREATEST(0, delivery_record.quantity_delivered - total_consumed_after);
  END LOOP;
  
  RAISE NOTICE 'Material deliveries quantity_remaining recalculated successfully';
END;
$function$;

-- Execute the recalculation
SELECT public.recalculate_material_deliveries_remaining();

-- Improve the consume_order_materials function with better error handling and debugging
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
  current_stock_info RECORD;
  material_info RECORD;
  available_deliveries_count INTEGER;
  total_available_qty numeric;
BEGIN
  -- Get workshop ID from order assignment
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
  
  RAISE NOTICE 'Iniciando consumo para orden % en taller %', order_id_param, workshop_id_record;
  
  -- Iterar sobre cada material a consumir
  FOR consumption_item IN SELECT * FROM jsonb_array_elements(consumption_data) LOOP
    material_uuid := (consumption_item->>'material_id')::uuid;
    quantity_to_consume := (consumption_item->>'quantity')::numeric;
    remaining_to_consume := quantity_to_consume;
    
    -- Get material info for logging
    SELECT name, sku INTO material_info
    FROM public.materials 
    WHERE id = material_uuid;
    
    -- Get current stock using the centralized function
    SELECT * INTO current_stock_info
    FROM public.get_workshop_material_stock(material_uuid, workshop_id_record);
    
    -- Count available deliveries and total available quantity
    SELECT 
      COUNT(*) as delivery_count,
      COALESCE(SUM(quantity_remaining), 0) as total_qty
    INTO available_deliveries_count, total_available_qty
    FROM public.material_deliveries 
    WHERE material_id = material_uuid 
      AND workshop_id = workshop_id_record
      AND quantity_remaining > 0;
    
    RAISE NOTICE 'Material: % (%) - Stock function: %, Direct sum: %, Deliveries count: %, Cantidad a consumir: %', 
      material_info.name, material_info.sku, 
      current_stock_info.available_stock, 
      total_available_qty,
      available_deliveries_count,
      quantity_to_consume;
    
    -- Check if we have enough stock BEFORE starting consumption
    IF current_stock_info.available_stock < quantity_to_consume THEN
      RAISE EXCEPTION 'Stock insuficiente para material % (%) en el taller %. Stock calculado: %, Stock directo: %, Entregas disponibles: %, Cantidad requerida: %, Faltante: % unidades', 
        material_info.name, 
        material_info.sku,
        (SELECT name FROM workshops WHERE id = workshop_id_record),
        current_stock_info.available_stock,
        total_available_qty,
        available_deliveries_count,
        quantity_to_consume,
        quantity_to_consume - current_stock_info.available_stock;
    END IF;
    
    -- Also check direct sum for debugging
    IF total_available_qty < quantity_to_consume THEN
      RAISE EXCEPTION 'Inconsistencia detectada: Stock calculado (%) vs suma directa (%) para material % (%)', 
        current_stock_info.available_stock, total_available_qty, material_info.name, material_info.sku;
    END IF;
    
    -- Consume from deliveries in FIFO order (oldest first)
    FOR delivery_record IN 
      SELECT id, quantity_remaining, workshop_id, delivery_date, created_at
      FROM public.material_deliveries 
      WHERE material_id = material_uuid 
        AND quantity_remaining > 0
        AND workshop_id = workshop_id_record
      ORDER BY delivery_date ASC, created_at ASC
    LOOP
      IF remaining_to_consume <= 0 THEN
        EXIT;
      END IF;
      
      -- Determine how much to consume from this delivery
      consume_from_delivery := LEAST(delivery_record.quantity_remaining, remaining_to_consume);
      
      RAISE NOTICE 'Consumiendo % de entrega % (disponible: %, fecha: %)', 
        consume_from_delivery, delivery_record.id, delivery_record.quantity_remaining, delivery_record.delivery_date;
      
      -- Create consumption record
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
        workshop_id_record,
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
      
      -- Update original delivery
      UPDATE public.material_deliveries 
      SET quantity_remaining = quantity_remaining - consume_from_delivery,
          updated_at = now()
      WHERE id = delivery_record.id;
      
      remaining_to_consume := remaining_to_consume - consume_from_delivery;
      
      RAISE NOTICE 'Actualizada entrega %. Nuevo remaining: %. Falta por consumir: %', 
        delivery_record.id, delivery_record.quantity_remaining - consume_from_delivery, remaining_to_consume;
    END LOOP;
    
    -- Final verification - this should never happen now with the pre-check
    IF remaining_to_consume > 0 THEN
      RAISE EXCEPTION 'Error inesperado: No se pudo consumir toda la cantidad para material % (%). Quedaron % unidades sin consumir', 
        material_info.name, material_info.sku, remaining_to_consume;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Consumo completado exitosamente para orden % en taller %', order_id_param, workshop_id_record;
END;
$function$;