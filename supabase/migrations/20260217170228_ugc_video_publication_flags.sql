-- Track publication progress for UGC videos (organic + ads)
ALTER TABLE public.ugc_videos
  ADD COLUMN IF NOT EXISTS published_organic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_organic_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_ads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_ads_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ugc_videos_org_published_organic
  ON public.ugc_videos(organization_id, published_organic);

CREATE INDEX IF NOT EXISTS idx_ugc_videos_org_published_ads
  ON public.ugc_videos(organization_id, published_ads);
