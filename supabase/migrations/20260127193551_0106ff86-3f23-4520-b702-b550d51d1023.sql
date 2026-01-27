-- Add retry counter for auto-invoicing to prevent infinite loops on failed orders
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_retries INTEGER DEFAULT 0;