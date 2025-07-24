-- Create a simple trigger that only updates delivery sync status without complex dependencies
CREATE OR REPLACE FUNCTION public.update_delivery_sync_status_simple()
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

-- Recreate the trigger with the new function
CREATE TRIGGER delivery_items_sync_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_delivery_sync_status_simple();