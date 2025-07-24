-- Fix sync status calculation to properly handle idempotency and already synced items
CREATE OR REPLACE FUNCTION public.fix_delivery_sync_status_inconsistencies()
RETURNS TABLE(delivery_id uuid, tracking_number text, status_before text, status_after text, items_synced integer, items_total integer)
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_record RECORD;
  items_with_approved_qty INTEGER;
  synced_approved_items INTEGER;
  should_be_synced BOOLEAN;
BEGIN
  -- Procesar todas las entregas que pueden tener inconsistencias
  FOR delivery_record IN
    SELECT 
      d.id,
      d.tracking_number,
      d.status,
      d.synced_to_shopify as current_sync_status
    FROM deliveries d
    WHERE d.status IN ('approved', 'partial_approved')
  LOOP
    -- Contar items que necesitan sincronización (quantity_approved > 0)
    SELECT COUNT(*) INTO items_with_approved_qty
    FROM delivery_items di
    WHERE di.delivery_id = delivery_record.id 
      AND di.quantity_approved > 0;
    
    -- Contar items que ya están sincronizados
    SELECT COUNT(*) INTO synced_approved_items
    FROM delivery_items di
    WHERE di.delivery_id = delivery_record.id 
      AND di.quantity_approved > 0 
      AND di.synced_to_shopify = true;
    
    -- Determinar si debería estar marcado como sincronizado
    should_be_synced := (items_with_approved_qty > 0 AND synced_approved_items = items_with_approved_qty) OR items_with_approved_qty = 0;
    
    -- Si hay discrepancia, corregirla
    IF delivery_record.current_sync_status != should_be_synced THEN
      UPDATE deliveries 
      SET 
        synced_to_shopify = should_be_synced,
        sync_error_message = CASE 
          WHEN should_be_synced THEN NULL 
          ELSE sync_error_message 
        END,
        updated_at = now()
      WHERE id = delivery_record.id;
      
      -- Retornar información de la corrección
      delivery_id := delivery_record.id;
      tracking_number := delivery_record.tracking_number;
      status_before := delivery_record.current_sync_status::text;
      status_after := should_be_synced::text;
      items_synced := synced_approved_items;
      items_total := items_with_approved_qty;
      
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$;

-- Ejecutar la corrección inmediatamente
SELECT * FROM public.fix_delivery_sync_status_inconsistencies();

-- Mejorar el trigger de recálculo para que sea más preciso
CREATE OR REPLACE FUNCTION public.recalculate_delivery_sync_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_uuid UUID;
  total_items INTEGER;
  items_with_approved_qty INTEGER;
  synced_approved_items INTEGER;
  delivery_status TEXT;
  should_be_synced BOOLEAN;
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
  
  -- Contar items que necesitan sincronización (quantity_approved > 0)
  SELECT COUNT(*) INTO items_with_approved_qty
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND quantity_approved > 0;
  
  -- Contar items que están realmente sincronizados
  SELECT COUNT(*) INTO synced_approved_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND quantity_approved > 0 
    AND synced_to_shopify = true;
  
  -- Lógica de sincronización:
  -- 1. Si está en revisión (pending, in_quality): NO sincronizado
  -- 2. Si no tiene items con cantidad aprobada: SINCRONIZADO (nada que sincronizar)
  -- 3. Si todos los items con cantidad aprobada están sincronizados: SINCRONIZADO
  -- 4. Caso contrario: NO sincronizado
  
  IF delivery_status IN ('pending', 'in_quality') THEN
    should_be_synced := false;
  ELSIF items_with_approved_qty = 0 THEN
    should_be_synced := true; -- Nada que sincronizar
  ELSE
    should_be_synced := (synced_approved_items = items_with_approved_qty);
  END IF;
  
  -- Actualizar el estado de la entrega
  UPDATE deliveries 
  SET 
    synced_to_shopify = should_be_synced,
    sync_error_message = CASE 
      WHEN should_be_synced THEN NULL 
      WHEN delivery_status IN ('pending', 'in_quality') THEN NULL
      ELSE sync_error_message 
    END,
    updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;