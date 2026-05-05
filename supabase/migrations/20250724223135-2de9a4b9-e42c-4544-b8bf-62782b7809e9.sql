-- Drop existing functions that need to change return types
DROP FUNCTION IF EXISTS public.fix_delivery_sync_status_inconsistencies();
DROP FUNCTION IF EXISTS public.clear_stale_sync_locks();
DROP FUNCTION IF EXISTS public.clear_delivery_sync_lock(UUID);

-- Function to repair sync status based on successful sync logs
CREATE OR REPLACE FUNCTION public.fix_delivery_sync_status_inconsistencies()
RETURNS jsonb
LANGUAGE plpgsql
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

-- Function to clear sync locks for stuck deliveries
CREATE OR REPLACE FUNCTION public.clear_delivery_sync_lock(delivery_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  delivery_record RECORD;
BEGIN
  -- Get delivery info
  SELECT d.tracking_number, d.synced_to_shopify, d.last_sync_attempt
  INTO delivery_record
  FROM public.deliveries d
  WHERE d.id = delivery_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found'
    );
  END IF;
  
  -- Reset sync lock by clearing sync attempts and error message
  UPDATE public.deliveries
  SET 
    sync_attempts = 0,
    sync_error_message = NULL,
    last_sync_attempt = NULL,
    updated_at = now()
  WHERE id = delivery_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'tracking_number', delivery_record.tracking_number,
    'message', 'Sync lock cleared successfully'
  );
END;
$function$;

-- Function to clear all stale sync locks (older than 2 hours)
CREATE OR REPLACE FUNCTION public.clear_stale_sync_locks()
RETURNS jsonb[]
LANGUAGE plpgsql
AS $function$
DECLARE
  cleared_count INTEGER;
BEGIN
  UPDATE public.deliveries
  SET 
    sync_attempts = 0,
    sync_error_message = NULL,
    last_sync_attempt = NULL,
    updated_at = now()
  WHERE 
    last_sync_attempt < now() - INTERVAL '2 hours'
    AND synced_to_shopify = false
    AND sync_attempts > 0;
  
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  
  RETURN ARRAY[jsonb_build_object(
    'success', true,
    'cleared_deliveries_count', cleared_count,
    'message', format('Cleared %s stale sync locks', cleared_count)
  )];
END;
$function$;