-- Add store_id to shopify_order_line_items
-- Required so that webhook and sync functions can tag line items per store

ALTER TABLE public.shopify_order_line_items
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- Backfill: inherit store_id from the parent shopify_order
UPDATE public.shopify_order_line_items li
  SET store_id = o.store_id
  FROM public.shopify_orders o
  WHERE li.shopify_order_id = o.shopify_order_id
    AND li.store_id IS NULL
    AND o.store_id IS NOT NULL;

-- Index for store-filtered queries
CREATE INDEX IF NOT EXISTS shopify_order_line_items_store_id_idx
  ON public.shopify_order_line_items(store_id);
