-- Fix order #66122: Update operational_status to awaiting_pickup (correct shopify_order_id)
UPDATE picking_packing_orders 
SET operational_status = 'awaiting_pickup', updated_at = now()
WHERE shopify_order_id = 6641455050931;

-- Add LISTO_PARA_RETIRO tag to shopify_orders for order #66122
UPDATE shopify_orders 
SET tags = CASE 
  WHEN tags IS NULL OR tags = '' THEN 'LISTO_PARA_RETIRO'
  WHEN tags NOT LIKE '%LISTO_PARA_RETIRO%' THEN tags || ', LISTO_PARA_RETIRO'
  ELSE tags
END
WHERE shopify_order_id = 6641455050931;