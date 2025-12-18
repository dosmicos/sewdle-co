-- Add columns to track Shopify fulfillment status on shipping labels
ALTER TABLE public.shipping_labels 
ADD COLUMN IF NOT EXISTS shopify_fulfillment_id text,
ADD COLUMN IF NOT EXISTS shopify_fulfillment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS shopify_fulfillment_error text;

-- Add comment for documentation
COMMENT ON COLUMN public.shipping_labels.shopify_fulfillment_id IS 'ID del fulfillment creado en Shopify';
COMMENT ON COLUMN public.shipping_labels.shopify_fulfillment_status IS 'Estado del fulfillment: pending, success, failed, skipped';
COMMENT ON COLUMN public.shipping_labels.shopify_fulfillment_error IS 'Mensaje de error si el fulfillment falla';