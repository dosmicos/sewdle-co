-- Backfill store_id on production orders that were created before multi-store support.
-- Assigns the Colombia store (country_code = 'CO') for each organization
-- to all orders that still have store_id = NULL.

UPDATE public.orders o
  SET store_id = s.id
  FROM public.stores s
  WHERE s.organization_id = o.organization_id
    AND s.country_code = 'CO'
    AND o.store_id IS NULL;

-- Index to speed up store-filtered queries on the orders table
CREATE INDEX IF NOT EXISTS orders_store_id_idx
  ON public.orders(store_id);
