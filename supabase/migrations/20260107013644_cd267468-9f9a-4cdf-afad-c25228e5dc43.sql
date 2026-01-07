-- =============================================
-- Fix: Crear trigger para actualizar status de órdenes automáticamente
-- =============================================

-- 1. Recrear la función con lógica mejorada
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  total_delivered INTEGER;
  order_uuid UUID;
  has_deliveries BOOLEAN;
  current_status TEXT;
BEGIN
  -- Obtener order_id desde delivery_items -> deliveries
  SELECT d.order_id INTO order_uuid
  FROM deliveries d
  WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Obtener status actual
  SELECT status INTO current_status FROM orders WHERE id = order_uuid;
  
  -- Calcular total ordenado
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM order_items WHERE order_id = order_uuid;
  
  -- Calcular total entregado
  SELECT COALESCE(SUM(di.quantity_delivered), 0) INTO total_delivered
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid;
  
  -- Calcular total aprobado
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid
    AND d.status IN ('approved', 'partial_approved', 'delivered');
  
  -- Verificar si hay entregas
  SELECT EXISTS(
    SELECT 1 FROM deliveries WHERE order_id = order_uuid
  ) INTO has_deliveries;
  
  -- Lógica de transición de estados
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    -- Orden completada al 100%
    UPDATE orders SET status = 'completed', updated_at = now() 
    WHERE id = order_uuid AND status != 'completed';
    
  ELSIF total_delivered > 0 OR has_deliveries THEN
    -- Hay entregas O unidades entregadas -> in_progress
    UPDATE orders SET status = 'in_progress', updated_at = now() 
    WHERE id = order_uuid
      AND status IN ('pending', 'assigned');
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS update_order_status_on_delivery_change ON delivery_items;

-- 3. Crear el trigger en delivery_items
CREATE TRIGGER update_order_status_on_delivery_change
AFTER INSERT OR UPDATE OR DELETE ON delivery_items
FOR EACH ROW
EXECUTE FUNCTION update_order_status_from_deliveries();

-- 4. También crear trigger cuando se crea una entrega (deliveries)
CREATE OR REPLACE FUNCTION public.update_order_status_on_delivery_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cuando se crea una entrega, cambiar a in_progress si está en pending o assigned
  UPDATE orders SET status = 'in_progress', updated_at = now() 
  WHERE id = NEW.order_id
    AND status IN ('pending', 'assigned');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_order_status_on_delivery_created ON deliveries;

CREATE TRIGGER update_order_status_on_delivery_created
AFTER INSERT ON deliveries
FOR EACH ROW
EXECUTE FUNCTION update_order_status_on_delivery_created();

-- 5. Corregir órdenes existentes que deberían estar en in_progress
UPDATE orders o
SET status = 'in_progress', updated_at = now()
WHERE o.status = 'assigned'
  AND EXISTS (
    SELECT 1 
    FROM deliveries d
    WHERE d.order_id = o.id
  );