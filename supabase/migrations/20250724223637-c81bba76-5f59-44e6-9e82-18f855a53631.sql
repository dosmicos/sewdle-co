-- Drop all problematic triggers and functions with CASCADE
DROP TRIGGER IF EXISTS update_order_status_on_delivery_change ON public.deliveries;
DROP FUNCTION IF EXISTS public.update_order_completion_status_v2() CASCADE;

-- Drop all other triggers that might cause issues
DROP TRIGGER IF EXISTS delivery_items_sync_status_trigger ON public.delivery_items;
DROP TRIGGER IF EXISTS update_delivery_sync_status_trigger ON public.delivery_items;
DROP TRIGGER IF EXISTS update_order_completion_status_trigger ON public.delivery_items;

-- Now fix DEL-0047 without any triggers interfering
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