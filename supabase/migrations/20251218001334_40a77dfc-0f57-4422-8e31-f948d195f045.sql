-- Fix order #65494 that has packed_at but missing EMPACADO tag in Shopify
UPDATE picking_packing_orders 
SET operational_status = 'pending', 
    packed_at = NULL, 
    packed_by = NULL,
    shipped_at = NULL,
    shipped_by = NULL,
    updated_at = NOW()
WHERE order_number = '65494';