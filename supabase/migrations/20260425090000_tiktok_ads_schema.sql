-- TikTok Ads schema
-- 1) Permitir 'tiktok_ads' en ad_accounts.platform
-- 2) Crear tabla tiktok_ads (metadata por anuncio)
-- 3) Crear tabla tiktok_ad_metrics_daily (metricas por anuncio por dia)

-- ─── 1) Extender CHECK constraint en ad_accounts ──────────────────────
ALTER TABLE ad_accounts DROP CONSTRAINT IF EXISTS ad_accounts_platform_check;
ALTER TABLE ad_accounts
  ADD CONSTRAINT ad_accounts_platform_check
  CHECK (platform IN ('meta', 'google_ads', 'google_analytics', 'tiktok_ads'));

-- ─── 2) Tabla tiktok_ads (metadata por ad) ────────────────────────────
CREATE TABLE IF NOT EXISTS tiktok_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  advertiser_id TEXT NOT NULL,
  tiktok_ad_id TEXT NOT NULL,
  tiktok_adgroup_id TEXT,
  tiktok_campaign_id TEXT,
  ad_name TEXT,
  adgroup_name TEXT,
  campaign_name TEXT,
  ad_text TEXT,
  call_to_action TEXT,
  video_id TEXT,
  image_urls TEXT[] DEFAULT '{}',
  landing_url TEXT,
  ad_format TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tiktok_ad_id)
);

-- ─── 3) Tabla tiktok_ad_metrics_daily ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tiktok_ad_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  tiktok_ad_id TEXT NOT NULL,
  date DATE NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  video_views INTEGER DEFAULT 0,
  video_views_2s INTEGER DEFAULT 0,
  video_views_6s INTEGER DEFAULT 0,
  video_views_p25 INTEGER DEFAULT 0,
  video_views_p50 INTEGER DEFAULT 0,
  video_views_p75 INTEGER DEFAULT 0,
  video_views_p100 INTEGER DEFAULT 0,
  cpc DECIMAL(8,2) DEFAULT 0,
  cpm DECIMAL(8,2) DEFAULT 0,
  ctr DECIMAL(6,4) DEFAULT 0,
  cvr DECIMAL(6,4) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cpa DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, tiktok_ad_id, date)
);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE tiktok_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_ad_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tiktok_ads for their org"
  ON tiktok_ads FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage tiktok_ads for their org"
  ON tiktok_ads FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view tiktok_ad_metrics for their org"
  ON tiktok_ad_metrics_daily FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage tiktok_ad_metrics for their org"
  ON tiktok_ad_metrics_daily FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

-- ─── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tiktok_ads_org
  ON tiktok_ads(organization_id);

CREATE INDEX IF NOT EXISTS idx_tiktok_ads_org_campaign
  ON tiktok_ads(organization_id, tiktok_campaign_id);

CREATE INDEX IF NOT EXISTS idx_tiktok_ads_org_adgroup
  ON tiktok_ads(organization_id, tiktok_adgroup_id);

CREATE INDEX IF NOT EXISTS idx_tiktok_ad_metrics_org_date
  ON tiktok_ad_metrics_daily(organization_id, date);

CREATE INDEX IF NOT EXISTS idx_tiktok_ad_metrics_org_ad_date
  ON tiktok_ad_metrics_daily(organization_id, tiktok_ad_id, date);
