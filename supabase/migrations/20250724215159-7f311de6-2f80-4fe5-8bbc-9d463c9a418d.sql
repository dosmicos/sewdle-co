-- CORRECCIÓN: Evitar auto-sincronización prematura de items con quantity_approved = 0
-- Solo permitir auto-sincronización cuando la entrega NO esté en estado de revisión

-- 1. Eliminar el trigger problemático existente PRIMERO
DROP TRIGGER IF EXISTS auto_sync_zero_quantity_items_trigger ON delivery_items;
DROP TRIGGER IF EXISTS trigger_auto_sync_zero_quantity ON delivery_items;

-- 2. Eliminar la función problemática
DROP FUNCTION IF EXISTS auto_sync_zero_quantity_items();

-- 3. Crear función mejorada que respeta el estado de la entrega
CREATE OR REPLACE FUNCTION auto_sync_zero_quantity_items()
RETURNS TRIGGER AS $$
DECLARE
  delivery_status TEXT;
BEGIN
  -- Obtener el estado de la entrega
  SELECT status INTO delivery_status
  FROM deliveries 
  WHERE id = NEW.delivery_id;
  
  -- Solo auto-sincronizar si quantity_approved es 0 Y la entrega NO está en revisión
  IF NEW.quantity_approved = 0 AND delivery_status NOT IN ('pending', 'in_quality') THEN
    NEW.synced_to_shopify = true;
    NEW.sync_error_message = 'Auto-sincronizado (cantidad 0)';
    NEW.last_sync_attempt = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Recrear el trigger con la lógica corregida
CREATE TRIGGER auto_sync_zero_quantity_items_trigger
  BEFORE INSERT OR UPDATE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_zero_quantity_items();

-- 5. LIMPIAR DATOS INCONSISTENTES: Resetear sincronización de items en entregas que están en revisión
UPDATE delivery_items 
SET 
  synced_to_shopify = false,
  sync_error_message = NULL,
  last_sync_attempt = NULL
WHERE delivery_id IN (
  SELECT id FROM deliveries 
  WHERE status IN ('pending', 'in_quality')
)
AND quantity_approved = 0
AND quantity_defective = 0
AND synced_to_shopify = true;

-- 6. Actualizar función recalculate_delivery_sync_status para ser más estricta
CREATE OR REPLACE FUNCTION recalculate_delivery_sync_status()
RETURNS TRIGGER AS $$
DECLARE
  delivery_uuid UUID;
  total_items INTEGER;
  synced_items INTEGER;
  items_with_approved_qty INTEGER;
  delivery_status TEXT;
BEGIN
  -- Obtener el delivery_id correcto
  delivery_uuid := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF delivery_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Obtener el estado de la entrega
  SELECT status INTO delivery_status
  FROM deliveries 
  WHERE id = delivery_uuid;
  
  -- Contar total de items en la entrega
  SELECT COUNT(*) INTO total_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  -- CORRECCIÓN: Solo contar como sincronizados los items que:
  -- 1. Están realmente sincronizados (synced_to_shopify = true) Y
  -- 2. La entrega NO está en estado de revisión Y
  -- 3. O tienen quantity_approved = 0 en entregas ya procesadas
  SELECT COUNT(*) INTO synced_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND (
      (synced_to_shopify = true AND delivery_status NOT IN ('pending', 'in_quality'))
      OR (quantity_approved = 0 AND delivery_status NOT IN ('pending', 'in_quality'))
    );
  
  -- Contar items con quantity_approved > 0 (que necesitan sincronización real)
  SELECT COUNT(*) INTO items_with_approved_qty
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND quantity_approved > 0;
  
  -- Actualizar el estado de la entrega
  UPDATE deliveries 
  SET 
    synced_to_shopify = CASE 
      WHEN delivery_status IN ('pending', 'in_quality') THEN false
      WHEN total_items = 0 THEN false
      ELSE (synced_items = total_items)
    END,
    sync_error_message = CASE 
      WHEN delivery_status IN ('pending', 'in_quality') THEN NULL
      WHEN synced_items = total_items AND total_items > 0 THEN NULL
      WHEN items_with_approved_qty = 0 THEN NULL
      ELSE sync_error_message
    END,
    updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Actualizar estados de entregas que están en revisión para asegurar consistencia
UPDATE deliveries 
SET 
  synced_to_shopify = false,
  sync_error_message = NULL
WHERE status IN ('pending', 'in_quality');

-- 8. Log de la corrección
INSERT INTO sync_control_logs (sync_type, sync_mode, status, start_time, end_time, details)
VALUES (
  'delivery_sync_fix',
  'manual',
  'completed',
  now(),
  now(),
  jsonb_build_object(
    'message', 'Corregida lógica de auto-sincronización para respetar estado de entregas en revisión',
    'affected_deliveries', (
      SELECT COUNT(*) FROM deliveries WHERE status IN ('pending', 'in_quality')
    ),
    'affected_items', (
      SELECT COUNT(*) FROM delivery_items di
      JOIN deliveries d ON di.delivery_id = d.id
      WHERE d.status IN ('pending', 'in_quality')
      AND di.quantity_approved = 0
      AND di.quantity_defective = 0
    )
  )
);