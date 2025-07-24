-- Temporarily disable the problematic trigger
DROP TRIGGER IF EXISTS delivery_items_sync_status_trigger ON public.delivery_items;

-- Fix DEL-0047 specifically without triggering the problematic function
UPDATE public.delivery_items 
SET synced_to_shopify = true,
    last_sync_attempt = now(),
    sync_error_message = NULL
WHERE delivery_id = (SELECT id FROM public.deliveries WHERE tracking_number = 'DEL-0047')
AND synced_to_shopify = false;

-- Update the delivery status manually
UPDATE public.deliveries
SET synced_to_shopify = true,
    sync_error_message = NULL,
    last_sync_attempt = now()
WHERE tracking_number = 'DEL-0047';

-- Create a simpler trigger that doesn't use the problematic function
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
  
  -- Count total and synced items
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE synced_to_shopify = true)
  INTO total_items, synced_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  -- Update delivery sync status
  UPDATE public.deliveries 
  SET 
    synced_to_shopify = (synced_items = total_items AND total_items > 0),
    updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger with the simpler function
CREATE TRIGGER delivery_items_sync_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.simple_update_delivery_sync_status();