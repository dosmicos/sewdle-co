-- 1. Sincronizar manualmente la variante específica que quedó pendiente
-- Primero, actualizamos el delivery_item específico para marcarlo como sincronizado
UPDATE delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_attempt_count = 1,
    sync_error_message = 'Sincronizado manualmente - variante pendiente'
WHERE id = '981a997e-e63b-4214-87d3-fe211bd21664';

-- 2. Crear función que actualice el estado de sincronización de entrega basado en TODOS los items
CREATE OR REPLACE FUNCTION update_delivery_sync_status()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  synced_items INTEGER;
  delivery_uuid UUID;
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
  
  -- Contar items sincronizados
  SELECT COUNT(*) INTO synced_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND synced_to_shopify = true;
  
  -- Solo marcar la entrega como sincronizada si TODOS los items están sincronizados
  UPDATE deliveries 
  SET synced_to_shopify = (synced_items = total_items AND total_items > 0),
      updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger para que se ejecute cuando se actualice delivery_items
DROP TRIGGER IF EXISTS trigger_update_delivery_sync_status ON delivery_items;
CREATE TRIGGER trigger_update_delivery_sync_status
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_sync_status();

-- 4. Ejecutar la función para recalcular el estado de todas las entregas existentes
DO $$
DECLARE
  delivery_record RECORD;
  total_items INTEGER;
  synced_items INTEGER;
BEGIN
  FOR delivery_record IN 
    SELECT DISTINCT id FROM deliveries WHERE synced_to_shopify = true
  LOOP
    -- Contar total de items en la entrega
    SELECT COUNT(*) INTO total_items
    FROM delivery_items 
    WHERE delivery_id = delivery_record.id;
    
    -- Contar items sincronizados
    SELECT COUNT(*) INTO synced_items
    FROM delivery_items 
    WHERE delivery_id = delivery_record.id 
      AND synced_to_shopify = true;
    
    -- Actualizar estado de sincronización basado en TODOS los items
    UPDATE deliveries 
    SET synced_to_shopify = (synced_items = total_items AND total_items > 0),
        updated_at = now()
    WHERE id = delivery_record.id;
    
    RAISE NOTICE 'Entrega %: % de % items sincronizados. Estado: %', 
      delivery_record.id, synced_items, total_items, (synced_items = total_items AND total_items > 0);
  END LOOP;
END $$;