
-- Paso 1: Función para actualizar stock de materiales
CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si es una nueva entrega de material
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'material_deliveries' THEN
    UPDATE public.materials 
    SET current_stock = current_stock + NEW.quantity_delivered,
        updated_at = now()
    WHERE id = NEW.material_id;
    RETURN NEW;
  END IF;
  
  -- Si se actualiza una entrega de material
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'material_deliveries' THEN
    UPDATE public.materials 
    SET current_stock = current_stock - OLD.quantity_delivered + NEW.quantity_delivered,
        updated_at = now()
    WHERE id = NEW.material_id;
    RETURN NEW;
  END IF;
  
  -- Si se elimina una entrega de material
  IF TG_OP = 'DELETE' AND TG_TABLE_NAME = 'material_deliveries' THEN
    UPDATE public.materials 
    SET current_stock = current_stock - OLD.quantity_delivered,
        updated_at = now()
    WHERE id = OLD.material_id;
    RETURN OLD;
  END IF;
  
  -- Si se consume material (cuando se actualiza quantity_consumed)
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'material_deliveries' AND 
     OLD.quantity_consumed != NEW.quantity_consumed THEN
    -- Revertir el consumo anterior y aplicar el nuevo
    UPDATE public.materials 
    SET current_stock = current_stock + OLD.quantity_consumed - NEW.quantity_consumed,
        updated_at = now()
    WHERE id = NEW.material_id;
    
    -- Actualizar quantity_remaining
    NEW.quantity_remaining = NEW.quantity_delivered - NEW.quantity_consumed;
    RETURN NEW;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Crear triggers para material_deliveries
DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_insert ON public.material_deliveries;
CREATE TRIGGER trigger_update_stock_on_delivery_insert
  AFTER INSERT ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_update ON public.material_deliveries;
CREATE TRIGGER trigger_update_stock_on_delivery_update
  AFTER UPDATE ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_delete ON public.material_deliveries;
CREATE TRIGGER trigger_update_stock_on_delivery_delete
  AFTER DELETE ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

-- Función para sincronizar el stock actual basado en los datos existentes
CREATE OR REPLACE FUNCTION public.recalculate_material_stock()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  material_record RECORD;
  total_delivered INTEGER;
  total_consumed INTEGER;
  calculated_stock INTEGER;
BEGIN
  -- Para cada material, recalcular el stock basado en entregas y consumos
  FOR material_record IN SELECT id FROM public.materials LOOP
    -- Calcular total entregado
    SELECT COALESCE(SUM(quantity_delivered), 0) 
    INTO total_delivered
    FROM public.material_deliveries 
    WHERE material_id = material_record.id;
    
    -- Calcular total consumido
    SELECT COALESCE(SUM(quantity_consumed), 0) 
    INTO total_consumed
    FROM public.material_deliveries 
    WHERE material_id = material_record.id;
    
    -- Stock actual = entregado - consumido
    calculated_stock := total_delivered - total_consumed;
    
    -- Actualizar el stock del material
    UPDATE public.materials 
    SET current_stock = calculated_stock,
        updated_at = now()
    WHERE id = material_record.id;
    
    RAISE NOTICE 'Material %: Entregado=%, Consumido=%, Stock=% ', 
      material_record.id, total_delivered, total_consumed, calculated_stock;
  END LOOP;
  
  -- También actualizar quantity_remaining en material_deliveries
  UPDATE public.material_deliveries 
  SET quantity_remaining = quantity_delivered - COALESCE(quantity_consumed, 0)
  WHERE quantity_remaining != (quantity_delivered - COALESCE(quantity_consumed, 0));
  
END;
$$;

-- Ejecutar la sincronización para corregir datos existentes
SELECT public.recalculate_material_stock();

-- Función para consumir materiales desde órdenes
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
      
      -- Actualizar la entrega
      UPDATE public.material_deliveries 
      SET quantity_consumed = COALESCE(quantity_consumed, 0) + consume_from_delivery,
          quantity_remaining = quantity_remaining - consume_from_delivery,
          updated_at = now()
      WHERE id = delivery_record.id;
      
      remaining_to_consume := remaining_to_consume - consume_from_delivery;
      
      RAISE NOTICE 'Consumido % de entrega % para material %', 
        consume_from_delivery, delivery_record.id, material_uuid;
    END LOOP;
    
    -- Si no se pudo consumir todo, lanzar error
    IF remaining_to_consume > 0 THEN
      RAISE EXCEPTION 'Stock insuficiente para material %. Faltaron % unidades.', 
        material_uuid, remaining_to_consume;
    END IF;
  END LOOP;
END;
$$;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_material_deliveries_material_date 
ON public.material_deliveries(material_id, delivery_date, created_at);

CREATE INDEX IF NOT EXISTS idx_material_deliveries_remaining 
ON public.material_deliveries(material_id, quantity_remaining) 
WHERE quantity_remaining > 0;
