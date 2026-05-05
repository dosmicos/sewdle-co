-- ═══════════════════════════════════════════════════════════════
-- UGC Creator Performance Tracking
-- Extends ugc_creators with scoring/metrics,
-- creates ugc_creator_ads for per-ad tracking
-- ═══════════════════════════════════════════════════════════════

-- 1. Add performance columns to existing ugc_creators
ALTER TABLE public.ugc_creators
  ADD COLUMN IF NOT EXISTS overall_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS roas_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS engagement_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS conversion_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS consistency_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS roi_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IS NULL OR tier IN ('S', 'A', 'B', 'C', 'D', 'new')),
  ADD COLUMN IF NOT EXISTS lifetime_spend NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_revenue NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_roas NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_purchases INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ads INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_ctr NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS avg_cpa NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS avg_hook_rate NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS avg_hold_rate NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS avg_lp_conv_rate NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS best_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS best_ad_roas NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS worst_ad_id TEXT,
  ADD COLUMN IF NOT EXISTS worst_ad_roas NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS best_product TEXT,
  ADD COLUMN IF NOT EXISTS best_product_roas NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS best_angle TEXT,
  ADD COLUMN IF NOT EXISTS best_angle_roas NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS recommendation TEXT,
  ADD COLUMN IF NOT EXISTS scores_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ugc_creators_tier ON ugc_creators(tier);
CREATE INDEX IF NOT EXISTS idx_ugc_creators_score ON ugc_creators(overall_score DESC NULLS LAST);


-- 2. Per-ad metrics for each creator
CREATE TABLE IF NOT EXISTS ugc_creator_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  creator_id UUID NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  -- Aggregated lifetime metrics for this ad
  total_spend NUMERIC(12,2) DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  roas NUMERIC(8,4) DEFAULT 0,
  cpa NUMERIC(12,2) DEFAULT 0,
  avg_ctr NUMERIC(6,4) DEFAULT 0,
  avg_hook_rate NUMERIC(6,2),
  avg_hold_rate NUMERIC(6,2),
  avg_lp_conv_rate NUMERIC(6,4),

  -- Context from ad_tags
  product TEXT,
  sales_angle TEXT,
  creative_type TEXT,

  -- Lifecycle
  first_seen DATE,
  last_seen DATE,
  days_active INTEGER,
  current_status TEXT,

  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, creator_id, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_ads_org_creator ON ugc_creator_ads(organization_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_ads_ad ON ugc_creator_ads(ad_id);
CREATE INDEX IF NOT EXISTS idx_creator_ads_roas ON ugc_creator_ads(roas DESC);

ALTER TABLE ugc_creator_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view creator ads for their org"
  ON ugc_creator_ads FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage creator ads"
  ON ugc_creator_ads FOR ALL
  USING (true) WITH CHECK (true);
