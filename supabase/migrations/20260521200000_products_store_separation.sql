-- Products Store Separation
-- Adds store_id to shopify_products and products tables

-- ─── 1. shopify_products: add store_id + organization_id ─────────────────────
ALTER TABLE public.shopify_products
  ADD COLUMN IF NOT EXISTS store_id       uuid REFERENCES public.stores(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Backfill: assign existing products to the Colombia store of each org
-- (all existing products are from Colombia)
UPDATE public.shopify_products sp
SET
  store_id        = s.id,
  organization_id = s.organization_id
FROM public.stores s
WHERE s.country_code = 'CO'
  AND sp.store_id IS NULL;

-- RLS for shopify_products (currently has no org isolation)
ALTER TABLE public.shopify_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_shopify_products" ON public.shopify_products
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_admins_can_manage_shopify_products" ON public.shopify_products
  FOR ALL
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

-- ─── 2. products (internal catalog): add store_id ────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- Backfill: assign existing internal products to the Colombia store
UPDATE public.products p
SET store_id = s.id
FROM public.stores s
WHERE s.country_code = 'CO'
  AND s.organization_id = p.organization_id
  AND p.store_id IS NULL;

-- ─── 3. Indices de rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS shopify_products_store_id_idx
  ON public.shopify_products(store_id);

CREATE INDEX IF NOT EXISTS shopify_products_organization_id_idx
  ON public.shopify_products(organization_id);

CREATE INDEX IF NOT EXISTS products_store_id_idx
  ON public.products(store_id);
