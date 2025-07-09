-- Fix order status logic - restore working trigger
-- First, manually fix ORD-0019 status
UPDATE orders 
SET status = 'in_progress',
    updated_at = now()
WHERE order_number = 'ORD-0019';

-- Recreate the trigger function with correct logic
CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  order_stats RECORD;
  delivery_order_id UUID;
BEGIN
  -- Get the order_id from the deliveries table
  SELECT d.order_id INTO delivery_order_id
  FROM deliveries d
  WHERE d.id = NEW.delivery_id;
  
  -- If no order_id found, return without doing anything
  IF delivery_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get order statistics
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats_v2(delivery_order_id);
  
  -- Update order status based on statistics
  -- Only mark as completed if NO pending units remain
  UPDATE orders 
  SET status = CASE 
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE status -- Keep current status if no deliveries
  END,
  updated_at = now()
  WHERE id = delivery_order_id;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for delivery_items changes
CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();