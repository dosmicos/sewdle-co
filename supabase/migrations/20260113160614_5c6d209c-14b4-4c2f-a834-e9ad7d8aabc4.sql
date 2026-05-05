-- Step 1: Clean existing duplicates (keep only the most recent one)
DELETE FROM shopify_order_line_items a
USING shopify_order_line_items b
WHERE a.shopify_order_id = b.shopify_order_id
  AND a.shopify_line_item_id = b.shopify_line_item_id
  AND a.created_at < b.created_at;

-- Step 2: Add UNIQUE constraint to prevent future duplicates
ALTER TABLE shopify_order_line_items
ADD CONSTRAINT unique_shopify_line_item 
UNIQUE (shopify_order_id, shopify_line_item_id);