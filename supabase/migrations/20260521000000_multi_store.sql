-- Multi-Store: Colombia + USA
-- Adds stores table and store_id to key order tables

-- ─── 1. Tabla stores ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  country_code        char(2),            -- 'CO', 'US'
  currency            text DEFAULT 'COP',
  shopify_store_url   text,               -- 'https://dosmicos.myshopify.com'
  shopify_credentials jsonb DEFAULT '{}', -- { access_token, configured_at, webhook_secret? }
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_stores" ON public.stores
  FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_admins_can_manage_stores" ON public.stores
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- ─── 2. Migrar credenciales Colombia existentes ───────────────────────────────
-- Crea una tienda "Colombia" por cada organización que ya tenga Shopify configurado
INSERT INTO public.stores (organization_id, name, country_code, currency, shopify_store_url, shopify_credentials)
SELECT
  id,
  'Colombia',
  'CO',
  'COP',
  shopify_store_url,
  COALESCE(shopify_credentials, '{}')
FROM public.organizations
WHERE shopify_store_url IS NOT NULL
ON CONFLICT DO NOTHING;

-- ─── 3. store_id en tablas de órdenes ────────────────────────────────────────
ALTER TABLE public.shopify_orders
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

ALTER TABLE public.picking_packing_orders
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- ─── 4. Backfill Colombia en órdenes existentes ───────────────────────────────
-- Asigna la tienda Colombia (country_code='CO') a todas las órdenes sin store_id
UPDATE public.shopify_orders so
  SET store_id = s.id
  FROM public.stores s
  WHERE s.organization_id = so.organization_id
    AND s.country_code = 'CO'
    AND so.store_id IS NULL;

UPDATE public.picking_packing_orders ppo
  SET store_id = s.id
  FROM public.stores s
  WHERE s.organization_id = ppo.organization_id
    AND s.country_code = 'CO'
    AND ppo.store_id IS NULL;

-- ─── 5. country_code en warehouses ───────────────────────────────────────────
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS country_code char(2) DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id);

-- Marcar todas las bodegas existentes como Colombia
UPDATE public.warehouses
  SET country_code = 'CO'
  WHERE country_code IS NULL;

-- ─── 6. Índices de rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS shopify_orders_store_id_idx
  ON public.shopify_orders(store_id);

CREATE INDEX IF NOT EXISTS picking_packing_orders_store_id_idx
  ON public.picking_packing_orders(store_id);

CREATE INDEX IF NOT EXISTS stores_organization_id_idx
  ON public.stores(organization_id);
