-- Add image_url column to shopify_order_line_items table
ALTER TABLE public.shopify_order_line_items 
ADD COLUMN IF NOT EXISTS image_url TEXT;