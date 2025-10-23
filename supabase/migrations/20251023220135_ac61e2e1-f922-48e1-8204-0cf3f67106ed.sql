-- Fix order status updates to consider approved and partial_approved delivery states
-- This corrects the issue where orders remain in 'assigned' or 'in_progress' status
-- even when they have approved deliveries or are 100% complete

CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  order_uuid UUID;
  has_approved_deliveries BOOLEAN;
BEGIN
  -- Get order_id from trigger context
  order_uuid := COALESCE(NEW.order_id, OLD.order_id);
  
  IF order_uuid IS NULL THEN
    SELECT d.order_id INTO order_uuid
    FROM deliveries d
    WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  END IF;
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calculate total ordered
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM order_items 
  WHERE order_id = order_uuid;
  
  -- Calculate total approved (including approved and partial_approved states)
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid
    AND d.status IN ('approved', 'partial_approved', 'delivered');
  
  -- Check if there are approved deliveries
  SELECT EXISTS(
    SELECT 1 
    FROM deliveries 
    WHERE order_id = order_uuid 
      AND status IN ('approved', 'partial_approved', 'delivered')
  ) INTO has_approved_deliveries;
  
  -- State transition logic
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    -- Order completed at 100%
    UPDATE orders 
    SET status = 'completed', updated_at = now() 
    WHERE id = order_uuid;
    
  ELSIF has_approved_deliveries THEN
    -- Has approved deliveries, order in progress
    UPDATE orders 
    SET status = 'in_progress', updated_at = now() 
    WHERE id = order_uuid
      AND status IN ('pending', 'assigned'); -- Only advance from pending/assigned
    
  ELSIF EXISTS (
    SELECT 1 
    FROM workshop_assignments 
    WHERE order_id = order_uuid 
      AND status IN ('assigned', 'in_progress')
  ) THEN
    -- Assigned to workshop but no deliveries
    UPDATE orders 
    SET status = 'assigned', updated_at = now() 
    WHERE id = order_uuid
      AND status = 'pending'; -- Only advance from pending to assigned
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update existing orders to correct their status based on approved deliveries
DO $$
DECLARE
  order_record RECORD;
  total_ordered INTEGER;
  total_approved INTEGER;
  has_approved_deliveries BOOLEAN;
BEGIN
  -- Process all orders that have approved deliveries
  FOR order_record IN 
    SELECT DISTINCT o.id, o.status, o.order_number
    FROM orders o
    WHERE EXISTS (
      SELECT 1 
      FROM deliveries d 
      WHERE d.order_id = o.id 
        AND d.status IN ('approved', 'partial_approved', 'delivered')
    )
  LOOP
    -- Calculate totals for this order
    SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
    FROM order_items 
    WHERE order_id = order_record.id;
    
    SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
    FROM delivery_items di
    JOIN deliveries d ON di.delivery_id = d.id
    WHERE d.order_id = order_record.id
      AND d.status IN ('approved', 'partial_approved', 'delivered');
    
    has_approved_deliveries := (total_approved > 0);
    
    -- Apply correct status
    IF total_approved >= total_ordered AND total_ordered > 0 THEN
      UPDATE orders 
      SET status = 'completed', updated_at = now() 
      WHERE id = order_record.id AND status != 'completed';
      
      RAISE NOTICE 'Order % updated to completed (% / % units)', 
        order_record.order_number, total_approved, total_ordered;
      
    ELSIF has_approved_deliveries THEN
      UPDATE orders 
      SET status = 'in_progress', updated_at = now() 
      WHERE id = order_record.id 
        AND status IN ('pending', 'assigned');
      
      RAISE NOTICE 'Order % updated to in_progress (% / % units)', 
        order_record.order_number, total_approved, total_ordered;
    END IF;
  END LOOP;
END $$;