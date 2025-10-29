-- Add order_number column to picking_packing_orders
ALTER TABLE picking_packing_orders 
ADD COLUMN order_number TEXT;

-- Create index for fast ordering (newest first)
CREATE INDEX idx_picking_packing_orders_order_number 
ON picking_packing_orders(order_number DESC);

-- Backfill existing data from shopify_orders
UPDATE picking_packing_orders ppo
SET order_number = so.order_number
FROM shopify_orders so
WHERE ppo.shopify_order_id = so.shopify_order_id
  AND ppo.organization_id = so.organization_id;

-- Add NOT NULL constraint after backfill
ALTER TABLE picking_packing_orders 
ALTER COLUMN order_number SET NOT NULL;

-- Function to sync order_number automatically on insert
CREATE OR REPLACE FUNCTION sync_picking_order_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Copy order_number from shopify_orders when creating picking order
  NEW.order_number := (
    SELECT order_number 
    FROM shopify_orders 
    WHERE shopify_order_id = NEW.shopify_order_id
      AND organization_id = NEW.organization_id
    LIMIT 1
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Trigger to auto-populate order_number on INSERT
CREATE TRIGGER trigger_sync_picking_order_number
BEFORE INSERT ON picking_packing_orders
FOR EACH ROW
EXECUTE FUNCTION sync_picking_order_number();