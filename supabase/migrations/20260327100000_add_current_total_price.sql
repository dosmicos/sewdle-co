-- Add current_total_price column (net price after refunds)
-- Shopify's current_total_price reflects the actual revenue after partial/full refunds
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS current_total_price NUMERIC DEFAULT 0;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS total_refunds NUMERIC DEFAULT 0;

-- Backfill from raw_data for existing orders
UPDATE shopify_orders
SET current_total_price = COALESCE(
  (raw_data->>'current_total_price')::numeric,
  total_price
),
total_refunds = total_price - COALESCE(
  (raw_data->>'current_total_price')::numeric,
  total_price
)
WHERE raw_data IS NOT NULL;

-- For orders without raw_data, use total_price as current_total_price
UPDATE shopify_orders
SET current_total_price = total_price,
    total_refunds = 0
WHERE raw_data IS NULL OR current_total_price = 0;
