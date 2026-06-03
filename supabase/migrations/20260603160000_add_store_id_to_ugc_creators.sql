-- Add store_id to ugc_creators so UGC creators can be scoped per store/country
-- (e.g. Colombia vs Dosmicos USA), filtered via the top-bar StoreSwitcher.
-- Nullable: a NULL store_id means "all stores" (shown regardless of active store).

ALTER TABLE public.ugc_creators
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ugc_creators_store ON public.ugc_creators(store_id);

-- Backfill: all existing creators belong to Colombia. Assign each Dosmicos
-- creator to that org's Colombia (CO) store. Other orgs have no creators yet.
UPDATE public.ugc_creators c
SET store_id = s.id
FROM public.stores s
WHERE c.store_id IS NULL
  AND s.organization_id = c.organization_id
  AND s.country_code = 'CO';
