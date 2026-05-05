-- One-time fix for DEL-0047 and similar deliveries with sync inconsistencies
-- This will fix deliveries that have successful sync logs but items still marked as unsynced

-- Fix DEL-0047 specifically
UPDATE public.delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_error_message = NULL
WHERE delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047')
AND synced_to_shopify = false
AND EXISTS (
  SELECT 1 FROM public.inventory_sync_logs isl
  WHERE isl.delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047')
  AND isl.success_count > 0
  AND isl.error_count = 0
);

-- Update the delivery status too
UPDATE public.deliveries
SET synced_to_shopify = (
  SELECT COUNT(*) = COUNT(*) FILTER (WHERE synced_to_shopify = true)
  FROM public.delivery_items
  WHERE delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047')
),
sync_error_message = NULL,
last_sync_attempt = now()
WHERE tracking_number = 'DEL-0047';