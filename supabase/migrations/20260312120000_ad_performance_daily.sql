-- Ad-level daily performance metrics from Meta Marketing API
CREATE TABLE IF NOT EXISTS ad_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  date DATE NOT NULL,

  -- Ad identification
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,

  -- Traffic metrics
  spend NUMERIC(12,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency NUMERIC(6,2) DEFAULT 0,
  cpm NUMERIC(10,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  link_clicks INTEGER DEFAULT 0,
  ctr NUMERIC(6,4) DEFAULT 0,
  cpc NUMERIC(10,2) DEFAULT 0,

  -- Conversion metrics (parsed from actions array)
  purchases INTEGER DEFAULT 0,
  revenue NUMERIC(12,2) DEFAULT 0,
  add_to_cart INTEGER DEFAULT 0,
  initiate_checkout INTEGER DEFAULT 0,
  landing_page_views INTEGER DEFAULT 0,

  -- Video metrics
  video_thruplay INTEGER,
  video_p25 INTEGER,
  video_p50 INTEGER,
  video_p75 INTEGER,
  video_p95 INTEGER,
  video_p100 INTEGER,
  video_avg_time NUMERIC(8,2),

  -- Calculated metrics
  roas NUMERIC(8,4) DEFAULT 0,
  cpa NUMERIC(12,2) DEFAULT 0,
  hook_rate NUMERIC(6,2),
  hold_rate NUMERIC(6,2),
  lp_conv_rate NUMERIC(6,4),
  atc_rate NUMERIC(6,4),

  -- Metadata
  synced_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, date, ad_id)
);

-- Indexes for fast queries
CREATE INDEX idx_ad_perf_org_date ON ad_performance_daily(organization_id, date DESC);
CREATE INDEX idx_ad_perf_campaign ON ad_performance_daily(campaign_id, date DESC);
CREATE INDEX idx_ad_perf_ad ON ad_performance_daily(ad_id, date DESC);

-- RLS policies
ALTER TABLE ad_performance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ad performance for their org"
  ON ad_performance_daily FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage ad performance"
  ON ad_performance_daily FOR ALL
  USING (true)
  WITH CHECK (true);
