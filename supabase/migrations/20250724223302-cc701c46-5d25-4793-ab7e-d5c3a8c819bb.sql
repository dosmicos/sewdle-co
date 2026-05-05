-- Update function to have proper security context
CREATE OR REPLACE FUNCTION public.fix_delivery_sync_status_inconsistencies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  fixed_count INTEGER := 0;
  delivery_record RECORD;
BEGIN
  -- Find delivery items that should be marked as synced based on successful sync logs
  FOR delivery_record IN
    SELECT DISTINCT 
      d.id as delivery_id,
      d.tracking_number
    FROM public.deliveries d
    INNER JOIN public.inventory_sync_logs isl ON d.id = isl.delivery_id
    WHERE isl.success_count > 0 
    AND isl.error_count = 0
    AND d.synced_to_shopify = false
  LOOP
    -- Check if all delivery items for this delivery have successful sync logs
    UPDATE public.delivery_items 
    SET synced_to_shopify = true,
        last_sync_attempt = now(),
        sync_error_message = NULL
    WHERE delivery_id = delivery_record.delivery_id
    AND synced_to_shopify = false
    AND EXISTS (
      SELECT 1 FROM public.inventory_sync_logs isl
      WHERE isl.delivery_id = delivery_record.delivery_id
      AND isl.success_count > 0
      AND isl.error_count = 0
    );
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    
    -- Update delivery sync status
    UPDATE public.deliveries
    SET synced_to_shopify = (
      SELECT COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true)
      FROM public.delivery_items
      WHERE delivery_id = delivery_record.delivery_id
    ),
    sync_error_message = NULL,
    last_sync_attempt = now()
    WHERE id = delivery_record.delivery_id;
    
    RAISE NOTICE 'Fixed sync status for delivery % (%) - % items updated', 
      delivery_record.tracking_number, delivery_record.delivery_id, fixed_count;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Fixed sync status inconsistencies for %s deliveries', fixed_count),
    'timestamp', now()
  );
END;
$function$;