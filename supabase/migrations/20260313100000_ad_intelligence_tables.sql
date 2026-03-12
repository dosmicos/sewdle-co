-- ═══════════════════════════════════════════════════════════════
-- Ad Intelligence: Creative Content, Audience Data, Tags,
-- Lifecycle, Weekly Summaries, Performance Patterns
-- ═══════════════════════════════════════════════════════════════

-- 1. Raw creative content per ad
CREATE TABLE IF NOT EXISTS ad_creative_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  -- Content
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  destination_url TEXT,
  call_to_action TEXT,

  -- Media
  media_type TEXT CHECK (media_type IN ('video', 'image', 'carousel', 'collection')),
  video_id TEXT,
  thumbnail_url TEXT,

  -- UGC
  ugc_creator_handle TEXT,

  -- Extracted from URL
  destination_type TEXT,
  destination_product_slug TEXT,
  destination_collection_slug TEXT,

  -- Context
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,

  first_synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, ad_id)
);

CREATE INDEX idx_creative_org_ad ON ad_creative_content(organization_id, ad_id);

ALTER TABLE ad_creative_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ad creative for their org"
  ON ad_creative_content FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage ad creative"
  ON ad_creative_content FOR ALL
  USING (true) WITH CHECK (true);


-- 2. Audience/targeting data per ad set
CREATE TABLE IF NOT EXISTS adset_audience_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  adset_id TEXT NOT NULL,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,

  -- Demographics
  age_min INTEGER,
  age_max INTEGER,
  age_range TEXT,
  gender TEXT,

  -- Location
  countries JSONB,
  cities JSONB,
  regions JSONB,
  location_summary TEXT,

  -- Audience type (auto-detected)
  audience_type TEXT,
  audience_type_detail TEXT,

  -- Interests and behaviors
  interests JSONB,
  behaviors JSONB,
  interests_summary TEXT,

  -- Custom audiences
  custom_audiences_included JSONB,
  custom_audiences_excluded JSONB,
  audiences_summary TEXT,

  -- Advantage+
  is_advantage_plus BOOLEAN DEFAULT FALSE,

  -- Platforms and positions
  platforms JSONB,
  positions JSONB,
  placements_summary TEXT,

  -- Budget
  daily_budget NUMERIC(12,2),
  lifetime_budget NUMERIC(14,2),
  optimization_goal TEXT,
  bid_strategy TEXT,

  -- Raw targeting JSON
  raw_targeting JSONB,

  synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, adset_id)
);

CREATE INDEX idx_adset_audience_org ON adset_audience_data(organization_id, adset_id);
CREATE INDEX idx_adset_audience_type ON adset_audience_data(audience_type);
CREATE INDEX idx_adset_advantage ON adset_audience_data(is_advantage_plus);

ALTER TABLE adset_audience_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view adset audience for their org"
  ON adset_audience_data FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage adset audience"
  ON adset_audience_data FOR ALL
  USING (true) WITH CHECK (true);


-- 3. AI + rule-generated tags per ad
CREATE TABLE IF NOT EXISTS ad_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  -- Creative tags
  creative_type TEXT,
  sales_angle TEXT,
  copy_type TEXT,
  hook_description TEXT,

  -- Product tags
  product TEXT,
  product_name TEXT,
  landing_page_type TEXT,

  -- Offer tags
  offer_type TEXT,
  offer_value TEXT,

  -- Funnel
  funnel_stage TEXT,

  -- Audience tags (from adset data, never AI-generated)
  audience_type TEXT,
  audience_type_detail TEXT,
  audience_gender TEXT,
  audience_age_range TEXT,
  audience_location TEXT,
  audience_interests TEXT,
  audience_custom_audiences TEXT,
  audience_exclusions TEXT,
  is_advantage_plus BOOLEAN,
  audience_platforms TEXT,
  audience_placements TEXT,

  -- Country
  target_country TEXT,
  target_cities TEXT,

  -- UGC
  ugc_creator_handle TEXT,

  -- Metadata
  confidence TEXT CHECK (confidence IN ('alto', 'medio', 'bajo')),
  tagged_by TEXT DEFAULT 'ai_auto',
  ai_model TEXT DEFAULT 'claude-sonnet-4',
  human_reviewed BOOLEAN DEFAULT FALSE,
  human_reviewed_at TIMESTAMPTZ,
  human_reviewed_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, ad_id)
);

CREATE INDEX idx_tags_org_ad ON ad_tags(organization_id, ad_id);
CREATE INDEX idx_tags_creative ON ad_tags(creative_type);
CREATE INDEX idx_tags_angle ON ad_tags(sales_angle);
CREATE INDEX idx_tags_product ON ad_tags(product);
CREATE INDEX idx_tags_funnel ON ad_tags(funnel_stage);
CREATE INDEX idx_tags_audience ON ad_tags(audience_type);
CREATE INDEX idx_tags_country ON ad_tags(target_country);
CREATE INDEX idx_tags_ugc ON ad_tags(ugc_creator_handle);
CREATE INDEX idx_tags_advantage ON ad_tags(is_advantage_plus);

ALTER TABLE ad_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ad tags for their org"
  ON ad_tags FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage ad tags"
  ON ad_tags FOR ALL
  USING (true) WITH CHECK (true);


-- 4. Ad lifecycle tracking
CREATE TABLE IF NOT EXISTS ad_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  first_seen DATE,
  last_seen DATE,
  days_active INTEGER,
  lifetime_spend NUMERIC(14,2),
  lifetime_revenue NUMERIC(14,2),
  lifetime_purchases INTEGER,
  lifetime_roas NUMERIC(8,4),
  lifetime_cpa NUMERIC(12,2),
  best_roas_day DATE,
  best_roas_value NUMERIC(8,4),
  fatigue_start_date DATE,
  days_to_fatigue INTEGER,
  current_status TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, ad_id)
);

CREATE INDEX idx_lifecycle_org_ad ON ad_lifecycle(organization_id, ad_id);
CREATE INDEX idx_lifecycle_status ON ad_lifecycle(current_status);

ALTER TABLE ad_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ad lifecycle for their org"
  ON ad_lifecycle FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage ad lifecycle"
  ON ad_lifecycle FOR ALL
  USING (true) WITH CHECK (true);


-- 5. Weekly ad summary
CREATE TABLE IF NOT EXISTS weekly_ad_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,

  total_spend NUMERIC(12,2),
  total_revenue NUMERIC(12,2),
  total_purchases INTEGER,
  avg_roas NUMERIC(8,4),
  avg_cpa NUMERIC(12,2),
  avg_ctr NUMERIC(6,4),
  avg_frequency NUMERIC(6,2),
  roas_trend NUMERIC(8,4),
  status TEXT,

  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, week_start, ad_id)
);

CREATE INDEX idx_weekly_org_week ON weekly_ad_summary(organization_id, week_start DESC);
CREATE INDEX idx_weekly_ad ON weekly_ad_summary(ad_id, week_start DESC);

ALTER TABLE weekly_ad_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view weekly summaries for their org"
  ON weekly_ad_summary FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage weekly summaries"
  ON weekly_ad_summary FOR ALL
  USING (true) WITH CHECK (true);


-- 6. Performance patterns by dimension
CREATE TABLE IF NOT EXISTS performance_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  dimension TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT,

  total_ads INTEGER,
  total_spend NUMERIC(14,2),
  total_revenue NUMERIC(14,2),
  total_purchases INTEGER,
  avg_roas NUMERIC(8,4),
  avg_cpa NUMERIC(12,2),
  avg_ctr NUMERIC(6,4),
  avg_hook_rate NUMERIC(6,2),
  median_days_to_fatigue INTEGER,
  roas_rank INTEGER,

  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, dimension, dimension_value, period_start, period_type)
);

CREATE INDEX idx_patterns_org_dim ON performance_patterns(organization_id, dimension, period_type);
CREATE INDEX idx_patterns_rank ON performance_patterns(roas_rank);

ALTER TABLE performance_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view performance patterns for their org"
  ON performance_patterns FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
CREATE POLICY "Service role can manage performance patterns"
  ON performance_patterns FOR ALL
  USING (true) WITH CHECK (true);
