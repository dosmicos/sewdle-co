-- Function to clear stale sync locks for deliveries
CREATE OR REPLACE FUNCTION public.clear_stale_sync_locks()
RETURNS TABLE(cleared_deliveries_count integer, cleared_delivery_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  cleared_count INTEGER := 0;
  cleared_ids UUID[] := '{}';
  delivery_record RECORD;
BEGIN
  -- Clear locks older than 15 minutes
  FOR delivery_record IN 
    SELECT id, tracking_number, last_sync_attempt
    FROM public.deliveries 
    WHERE last_sync_attempt IS NOT NULL
      AND synced_to_shopify = false
      AND last_sync_attempt < now() - INTERVAL '15 minutes'
  LOOP
    -- Update the delivery to clear the sync lock
    UPDATE public.deliveries 
    SET last_sync_attempt = NULL,
        sync_error_message = 'Sync lock cleared due to timeout'
    WHERE id = delivery_record.id;
    
    cleared_count := cleared_count + 1;
    cleared_ids := array_append(cleared_ids, delivery_record.id);
    
    RAISE NOTICE 'Cleared stale sync lock for delivery %: %', 
      delivery_record.tracking_number, delivery_record.id;
  END LOOP;
  
  RETURN QUERY SELECT cleared_count, cleared_ids;
END;
$function$;

-- Function to manually clear sync lock for a specific delivery
CREATE OR REPLACE FUNCTION public.clear_delivery_sync_lock(delivery_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  delivery_exists BOOLEAN := false;
  tracking_num TEXT;
  was_locked BOOLEAN := false;
BEGIN
  -- Check if delivery exists and get tracking number
  SELECT 
    EXISTS(SELECT 1 FROM public.deliveries WHERE id = delivery_id_param),
    tracking_number,
    last_sync_attempt IS NOT NULL
  INTO delivery_exists, tracking_num, was_locked
  FROM public.deliveries 
  WHERE id = delivery_id_param;
  
  IF NOT delivery_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found',
      'delivery_id', delivery_id_param
    );
  END IF;
  
  -- Clear the sync lock
  UPDATE public.deliveries 
  SET last_sync_attempt = NULL,
      sync_error_message = 'Sync lock manually cleared by administrator',
      sync_attempts = COALESCE(sync_attempts, 0)
  WHERE id = delivery_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Sync lock cleared for delivery %s', tracking_num),
    'delivery_id', delivery_id_param,
    'tracking_number', tracking_num,
    'was_locked', was_locked,
    'cleared_at', now()
  );
END;
$function$;

-- Function to get sync status for deliveries
CREATE OR REPLACE FUNCTION public.get_delivery_sync_status(delivery_id_param uuid DEFAULT NULL)
RETURNS TABLE(
  delivery_id uuid,
  tracking_number text,
  synced_to_shopify boolean,
  sync_attempts integer,
  last_sync_attempt timestamp with time zone,
  sync_error_message text,
  is_locked boolean,
  lock_age_minutes integer,
  can_sync boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.synced_to_shopify,
    d.sync_attempts,
    d.last_sync_attempt,
    d.sync_error_message,
    (d.last_sync_attempt IS NOT NULL AND d.last_sync_attempt > now() - INTERVAL '15 minutes') as is_locked,
    CASE 
      WHEN d.last_sync_attempt IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (now() - d.last_sync_attempt)) / 60
      ELSE NULL 
    END::integer as lock_age_minutes,
    (d.last_sync_attempt IS NULL OR d.last_sync_attempt <= now() - INTERVAL '15 minutes') as can_sync
  FROM public.deliveries d
  WHERE (delivery_id_param IS NULL OR d.id = delivery_id_param)
  ORDER BY d.created_at DESC;
$function$;