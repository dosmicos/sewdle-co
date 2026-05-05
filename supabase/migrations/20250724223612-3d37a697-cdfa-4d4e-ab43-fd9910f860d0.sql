-- Drop all triggers that might cause issues
DROP TRIGGER IF EXISTS delivery_items_sync_status_trigger ON public.delivery_items;
DROP TRIGGER IF EXISTS update_delivery_sync_status_trigger ON public.delivery_items;
DROP TRIGGER IF EXISTS update_order_completion_status_trigger ON public.delivery_items;

-- Drop the problematic function that references non-existent tables
DROP FUNCTION IF EXISTS public.update_order_completion_status_v2();

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

-- Create a simple trigger that only updates delivery sync status
CREATE OR REPLACE FUNCTION public.simple_update_delivery_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  total_items INTEGER;
  synced_items INTEGER;
  delivery_uuid UUID;
BEGIN
  delivery_uuid := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF delivery_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE synced_to_shopify = true)
  INTO total_items, synced_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  UPDATE public.deliveries 
  SET 
    synced_to_shopify = (synced_items = total_items AND total_items > 0),
    updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate only the essential trigger
CREATE TRIGGER delivery_items_sync_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.simple_update_delivery_sync_status();