-- Fix order #64298 that has incorrect operational_status
-- This order has operational_status = 'ready_to_ship' but packed_at is NULL
UPDATE picking_packing_orders 
SET operational_status = 'pending', updated_at = now()
WHERE order_number = '64298' AND packed_at IS NULL;