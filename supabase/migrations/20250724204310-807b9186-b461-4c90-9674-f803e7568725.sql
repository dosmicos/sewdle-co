
-- 1. Crear trigger automático para marcar items con quantity_approved = 0 como sincronizados
CREATE OR REPLACE FUNCTION auto_sync_zero_quantity_items()
RETURNS TRIGGER AS $$
BEGIN
  -- Si quantity_approved es 0, marcar automáticamente como sincronizado
  IF NEW.quantity_approved = 0 THEN
    NEW.synced_to_shopify = true;
    NEW.sync_error_message = 'Auto-sincronizado (cantidad 0)';
    NEW.last_sync_attempt = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta antes de INSERT o UPDATE en delivery_items
DROP TRIGGER IF EXISTS trigger_auto_sync_zero_quantity ON delivery_items;
CREATE TRIGGER trigger_auto_sync_zero_quantity
  BEFORE INSERT OR UPDATE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_zero_quantity_items();

-- 2. Actualizar items existentes con quantity_approved = 0 que no están sincronizados
UPDATE delivery_items 
SET 
  synced_to_shopify = true,
  sync_error_message = 'Auto-sincronizado (cantidad 0 - corrección)',
  last_sync_attempt = now()
WHERE quantity_approved = 0 
  AND synced_to_shopify = false;

-- 3. Crear función mejorada para verificar estado de sincronización de entregas
CREATE OR REPLACE FUNCTION recalculate_delivery_sync_status()
RETURNS TRIGGER AS $$
DECLARE
  delivery_uuid UUID;
  total_items INTEGER;
  synced_items INTEGER;
  items_with_approved_qty INTEGER;
BEGIN
  -- Obtener el delivery_id correcto
  delivery_uuid := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF delivery_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Contar total de items en la entrega
  SELECT COUNT(*) INTO total_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  -- Contar items que están sincronizados O tienen quantity_approved = 0
  SELECT COUNT(*) INTO synced_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND (synced_to_shopify = true OR quantity_approved = 0);
  
  -- Contar items con quantity_approved > 0 (que necesitan sincronización real)
  SELECT COUNT(*) INTO items_with_approved_qty
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND quantity_approved > 0;
  
  -- Actualizar el estado de la entrega
  UPDATE deliveries 
  SET 
    synced_to_shopify = (synced_items = total_items AND total_items > 0),
    sync_error_message = CASE 
      WHEN synced_items = total_items AND total_items > 0 THEN NULL
      WHEN items_with_approved_qty = 0 THEN NULL  -- Si no hay items que sincronizar, no hay error
      ELSE sync_error_message
    END,
    updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Reemplazar el trigger existente con la función mejorada
DROP TRIGGER IF EXISTS update_delivery_sync_status ON delivery_items;
CREATE TRIGGER update_delivery_sync_status
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_delivery_sync_status();

-- 4. Recalcular estado de todas las entregas afectadas
UPDATE deliveries 
SET synced_to_shopify = (
  SELECT CASE 
    WHEN COUNT(*) = 0 THEN false
    ELSE COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
  END
  FROM delivery_items 
  WHERE delivery_items.delivery_id = deliveries.id
),
sync_error_message = CASE 
  WHEN (
    SELECT CASE 
      WHEN COUNT(*) = 0 THEN false
      ELSE COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
    END
    FROM delivery_items 
    WHERE delivery_items.delivery_id = deliveries.id
  ) THEN NULL
  ELSE sync_error_message
END,
updated_at = now()
WHERE status IN ('approved', 'partial_approved');
