-- Drop ALL remaining problematic functions
DROP FUNCTION IF EXISTS public.get_order_delivery_stats(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_order_delivery_stats_v2(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_order_completion_status() CASCADE;
DROP FUNCTION IF EXISTS public.update_order_completion_status_v2() CASCADE;

-- Finally fix DEL-0047 
UPDATE public.delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_error_message = NULL
WHERE delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047');

UPDATE public.deliveries
SET synced_to_shopify = true,
    sync_error_message = NULL,
    last_sync_attempt = now()
WHERE tracking_number = 'DEL-0047';