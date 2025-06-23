
-- Corregir problemas de stock de materiales

-- 1. Primero corregir los triggers que no están funcionando correctamente
DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_insert ON public.material_deliveries;
DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_update ON public.material_deliveries;
DROP TRIGGER IF EXISTS trigger_update_stock_on_delivery_delete ON public.material_deliveries;

-- 2. Recrear la función update_material_stock con correcciones
CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si es una nueva entrega de material (quantity_delivered > 0)
  IF TG_OP = 'INSERT' AND NEW.quantity_delivered > 0 THEN
    UPDATE public.materials 
    SET current_stock = current_stock + NEW.quantity_delivered,
        updated_at = now()
    WHERE id = NEW.material_id;
    RETURN NEW;
  END IF;
  
  -- Si se actualiza una entrega de material
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'material_deliveries' THEN
    -- Solo afectar el stock si cambió quantity_delivered o quantity_consumed
    IF OLD.quantity_delivered != NEW.quantity_delivered OR OLD.quantity_consumed != NEW.quantity_consumed THEN
      UPDATE public.materials 
      SET current_stock = current_stock 
        - COALESCE(OLD.quantity_delivered, 0) 
        + COALESCE(NEW.quantity_delivered, 0)
        + COALESCE(OLD.quantity_consumed, 0) 
        - COALESCE(NEW.quantity_consumed, 0),
          updated_at = now()
      WHERE id = NEW.material_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Si se elimina una entrega de material
  IF TG_OP = 'DELETE' AND OLD.quantity_delivered > 0 THEN
    UPDATE public.materials 
    SET current_stock = current_stock - OLD.quantity_delivered + COALESCE(OLD.quantity_consumed, 0),
        updated_at = now()
    WHERE id = OLD.material_id;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Recrear los triggers
CREATE TRIGGER trigger_update_stock_on_delivery_insert
  AFTER INSERT ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

CREATE TRIGGER trigger_update_stock_on_delivery_update
  AFTER UPDATE ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

CREATE TRIGGER trigger_update_stock_on_delivery_delete
  AFTER DELETE ON public.material_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_material_stock();

-- 4. Actualizar la función recalculate_material_stock para mayor precisión
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
  FOR material_record IN SELECT id, name, sku FROM public.materials LOOP
    -- Calcular total entregado (solo registros con quantity_delivered > 0)
    SELECT COALESCE(SUM(quantity_delivered), 0) 
    INTO total_delivered
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_delivered > 0;
    
    -- Calcular total consumido (solo registros con quantity_consumed > 0)
    SELECT COALESCE(SUM(quantity_consumed), 0) 
    INTO total_consumed
    FROM public.material_deliveries 
    WHERE material_id = material_record.id AND quantity_consumed > 0;
    
    -- Stock actual = entregado - consumido
    calculated_stock := total_delivered - total_consumed;
    
    -- Actualizar el stock del material
    UPDATE public.materials 
    SET current_stock = calculated_stock,
        updated_at = now()
    WHERE id = material_record.id;
    
    RAISE NOTICE 'Material % (%): Entregado=%, Consumido=%, Stock Final=%', 
      material_record.name, material_record.sku, total_delivered, total_consumed, calculated_stock;
  END LOOP;
  
  -- También actualizar quantity_remaining en material_deliveries para entregas
  UPDATE public.material_deliveries 
  SET quantity_remaining = quantity_delivered - COALESCE(quantity_consumed, 0)
  WHERE quantity_delivered > 0 
    AND quantity_remaining != (quantity_delivered - COALESCE(quantity_consumed, 0));
  
  RAISE NOTICE 'Recálculo de stock completado para todos los materiales';
END;
$$;

-- 5. Ejecutar el recálculo para corregir el stock actual
SELECT public.recalculate_material_stock();
