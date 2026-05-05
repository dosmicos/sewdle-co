-- Crear función RPC que falta para arreglar inconsistencias de sync
CREATE OR REPLACE FUNCTION public.fix_delivery_sync_status_inconsistencies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  delivery_record RECORD;
BEGIN
  -- Buscar deliveries donde el estado de sync no coincide con los delivery_items
  FOR delivery_record IN
    SELECT 
      d.id,
      d.tracking_number,
      d.synced_to_shopify as delivery_synced,
      COUNT(di.id) as total_items,
      COUNT(di.id) FILTER (WHERE di.synced_to_shopify = true) as synced_items
    FROM deliveries d
    LEFT JOIN delivery_items di ON d.id = di.delivery_id
    GROUP BY d.id, d.tracking_number, d.synced_to_shopify
    HAVING 
      (d.synced_to_shopify = true AND COUNT(di.id) FILTER (WHERE di.synced_to_shopify = true) != COUNT(di.id))
      OR
      (d.synced_to_shopify = false AND COUNT(di.id) > 0 AND COUNT(di.id) FILTER (WHERE di.synced_to_shopify = true) = COUNT(di.id))
  LOOP
    -- Determinar el estado correcto basado en los items
    DECLARE
      should_be_synced BOOLEAN;
    BEGIN
      should_be_synced := (delivery_record.total_items > 0 AND delivery_record.synced_items = delivery_record.total_items);
      
      -- Actualizar el estado de la delivery
      UPDATE deliveries 
      SET 
        synced_to_shopify = should_be_synced,
        updated_at = now()
      WHERE id = delivery_record.id;
      
      fixed_count := fixed_count + 1;
      
      RAISE NOTICE 'Fixed delivery %: % items, % synced -> synced_to_shopify = %', 
        delivery_record.tracking_number, 
        delivery_record.total_items, 
        delivery_record.synced_items, 
        should_be_synced;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'fixed_deliveries', fixed_count,
    'message', format('Fixed %s delivery sync status inconsistencies', fixed_count)
  );
END;
$function$;

-- Actualizar las credenciales de Shopify para la organización Dosmicos
UPDATE organizations 
SET 
  shopify_store_url = 'https://dosmicos.myshopify.com',
  shopify_credentials = jsonb_build_object(
    'store_domain', 'dosmicos.myshopify.com',
    'access_token', '${SHOPIFY_ACCESS_TOKEN}'
  ),
  updated_at = now()
WHERE name = 'Dosmicos';