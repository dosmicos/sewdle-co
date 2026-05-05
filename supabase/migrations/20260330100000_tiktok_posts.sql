-- ============================================================
-- TikTok Analytics: tiktok_connections + tiktok_posts
-- ============================================================

-- 1. Connections table (OAuth tokens)
CREATE TABLE IF NOT EXISTS public.tiktok_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tiktok_user_id TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tiktok_user_id)
);

-- 2. Posts table (video data + metrics)
CREATE TABLE IF NOT EXISTS public.tiktok_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  external_video_id TEXT NOT NULL,
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  -- Metrics
  views BIGINT DEFAULT 0,
  likes BIGINT DEFAULT 0,
  comments BIGINT DEFAULT 0,
  shares BIGINT DEFAULT 0,
  saves BIGINT DEFAULT 0,
  avg_watch_time NUMERIC DEFAULT 0,
  full_video_watched_rate NUMERIC DEFAULT 0,
  reach BIGINT DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  -- Classification
  content_category TEXT,
  performance_score NUMERIC DEFAULT 0,
  -- Sound info
  sound_name TEXT,
  is_original_sound BOOLEAN DEFAULT false,
  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, external_video_id)
);

-- 3. Indexes
CREATE INDEX idx_tiktok_connections_org ON public.tiktok_connections(organization_id);
CREATE INDEX idx_tiktok_posts_org ON public.tiktok_posts(organization_id);
CREATE INDEX idx_tiktok_posts_published ON public.tiktok_posts(organization_id, published_at DESC);
CREATE INDEX idx_tiktok_posts_performance ON public.tiktok_posts(organization_id, performance_score DESC);

-- 4. RLS
ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;

-- tiktok_connections policies
CREATE POLICY "Users can view own org tiktok connections"
  ON public.tiktok_connections FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org tiktok connections"
  ON public.tiktok_connections FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org tiktok connections"
  ON public.tiktok_connections FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- tiktok_posts policies
CREATE POLICY "Users can view own org tiktok posts"
  ON public.tiktok_posts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org tiktok posts"
  ON public.tiktok_posts FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org tiktok posts"
  ON public.tiktok_posts FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- 5. Updated_at trigger for connections
CREATE OR REPLACE FUNCTION public.update_tiktok_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tiktok_connections_updated_at
  BEFORE UPDATE ON public.tiktok_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tiktok_connections_updated_at();
