-- Track publication progress for UGC videos (organic + ads)
ALTER TABLE public.ugc_videos
  ADD COLUMN IF NOT EXISTS published_organic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_organic_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_ads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_ads_at timestamptz;

-- Backfill: legacy "publicado" status implies organic publication
UPDATE public.ugc_videos
SET
  published_organic = true,
  published_organic_at = COALESCE(published_organic_at, updated_at)
WHERE status = 'publicado'
  AND published_organic = false;

CREATE INDEX IF NOT EXISTS idx_ugc_videos_org_published_organic
  ON public.ugc_videos(organization_id, published_organic);

CREATE INDEX IF NOT EXISTS idx_ugc_videos_org_published_ads
  ON public.ugc_videos(organization_id, published_ads);
