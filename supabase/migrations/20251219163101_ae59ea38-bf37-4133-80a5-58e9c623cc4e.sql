-- Add Alegra invoice tracking fields to shopify_orders
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS alegra_invoice_id INTEGER,
ADD COLUMN IF NOT EXISTS alegra_invoice_number TEXT,
ADD COLUMN IF NOT EXISTS alegra_invoice_status TEXT,
ADD COLUMN IF NOT EXISTS alegra_stamped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS alegra_cufe TEXT,
ADD COLUMN IF NOT EXISTS alegra_synced_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shopify_orders_alegra_invoice_id ON shopify_orders(alegra_invoice_id);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_alegra_stamped ON shopify_orders(alegra_stamped);