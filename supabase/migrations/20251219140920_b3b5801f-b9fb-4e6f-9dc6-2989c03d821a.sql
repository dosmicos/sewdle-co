-- Drop the existing constraint
ALTER TABLE picking_packing_orders 
DROP CONSTRAINT picking_packing_orders_operational_status_check;

-- Add the updated constraint with awaiting_pickup
ALTER TABLE picking_packing_orders 
ADD CONSTRAINT picking_packing_orders_operational_status_check 
CHECK (operational_status = ANY (ARRAY['pending'::text, 'picking'::text, 'packing'::text, 'ready_to_ship'::text, 'awaiting_pickup'::text, 'shipped'::text]));