-- Create a function to mark delivery items as synced
CREATE OR REPLACE FUNCTION mark_delivery_as_synced(p_delivery_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE delivery_items 
  SET 
    synced_to_shopify = true,
    sync_attempt_count = COALESCE(sync_attempt_count, 0) + 1,
    last_sync_attempt = NOW(),
    sync_error_message = NULL
  WHERE delivery_id = p_delivery_id
    AND synced_to_shopify = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Also update the parent delivery record
  UPDATE deliveries
  SET 
    synced_to_shopify = true,
    sync_error_message = NULL,
    last_sync_attempt = NOW()
  WHERE id = p_delivery_id;
  
  RETURN updated_count;
END;
$$;

-- Execute immediately for DEL-0353
SELECT mark_delivery_as_synced('55333af1-aca4-4ab8-9b3c-8e396a213ef5');