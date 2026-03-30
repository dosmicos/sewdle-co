-- Social Posts table for Instagram/Facebook organic content analytics
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  external_post_id TEXT NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('image', 'carousel', 'reel', 'story', 'video', 'text')),
  caption TEXT DEFAULT '',
  hashtags TEXT[] DEFAULT '{}',
  published_at TIMESTAMPTZ NOT NULL,
  permalink TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  -- Engagement metrics
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  -- Reel/Video specific
  plays INTEGER,
  avg_watch_time FLOAT,
  -- Computed/AI-tagged
  content_category TEXT DEFAULT 'uncategorized',
  performance_score FLOAT DEFAULT 0,
  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one post per platform per org
  UNIQUE(org_id, platform, external_post_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_social_posts_org_id ON social_posts(org_id);
CREATE INDEX idx_social_posts_platform ON social_posts(org_id, platform);
CREATE INDEX idx_social_posts_published_at ON social_posts(org_id, published_at DESC);
CREATE INDEX idx_social_posts_post_type ON social_posts(org_id, post_type);
CREATE INDEX idx_social_posts_performance ON social_posts(org_id, performance_score DESC);

-- Row Level Security
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view social posts from their organization"
  ON social_posts FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert social posts for their organization"
  ON social_posts FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update social posts from their organization"
  ON social_posts FOR UPDATE
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all social posts"
  ON social_posts FOR ALL
  USING (auth.role() = 'service_role');
