
-- Paso 1: Actualizar la función trigger para considerar items con cantidad 0 como sincronizados
CREATE OR REPLACE FUNCTION public.update_delivery_sync_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
  
  -- Contar items sincronizados O items con cantidad aprobada = 0
  SELECT COUNT(*) INTO synced_items
  FROM delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND (synced_to_shopify = true OR quantity_approved = 0);
  
  -- Marcar la entrega como sincronizada si TODOS los items están sincronizados o tienen cantidad 0
  UPDATE deliveries 
  SET synced_to_shopify = (synced_items = total_items AND total_items > 0),
      updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Paso 2: Marcar retroactivamente como sincronizados todos los items con quantity_approved = 0
UPDATE delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_error_message = 'Auto-marcado como sincronizado (cantidad 0)'
WHERE quantity_approved = 0 
  AND synced_to_shopify = false;

-- Paso 3: Ejecutar manualmente el trigger para recalcular el estado de sincronización de las entregas
DO $$
DECLARE
  delivery_record RECORD;
BEGIN
  FOR delivery_record IN 
    SELECT DISTINCT delivery_id 
    FROM delivery_items 
    WHERE quantity_approved = 0
  LOOP
    -- Simular el trigger para cada entrega afectada
    PERFORM public.update_delivery_sync_status();
  END LOOP;
END $$;

-- Paso 4: Actualizar manualmente el estado de sincronización de las entregas
UPDATE deliveries 
SET synced_to_shopify = (
  SELECT COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
  FROM delivery_items 
  WHERE delivery_items.delivery_id = deliveries.id
),
sync_error_message = CASE 
  WHEN (
    SELECT COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true OR quantity_approved = 0)
    FROM delivery_items 
    WHERE delivery_items.delivery_id = deliveries.id
  ) THEN NULL
  ELSE sync_error_message
END,
updated_at = now()
WHERE id IN (
  SELECT DISTINCT delivery_id 
  FROM delivery_items 
  WHERE quantity_approved = 0
);
