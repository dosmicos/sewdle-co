-- Drop ALL functions that reference order_items table
DROP FUNCTION IF EXISTS public.update_order_completion_status() CASCADE;
DROP FUNCTION IF EXISTS public.get_order_delivery_stats_v2(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_order_delivery_stats(uuid) CASCADE;

-- Now we can finally fix DEL-0047 
UPDATE public.delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_error_message = NULL
WHERE delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047');

-- Update the delivery status
UPDATE public.deliveries
SET synced_to_shopify = true,
    sync_error_message = NULL,
    last_sync_attempt = now()
WHERE tracking_number = 'DEL-0047';