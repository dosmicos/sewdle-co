-- Finance Dashboard Tables
-- Credenciales de cuentas de ads
CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google_ads', 'google_analytics')),
  account_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Métricas diarias de ads (Meta + Google)
CREATE TABLE IF NOT EXISTS ad_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(12,2) DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  cpc DECIMAL(8,2) DEFAULT 0,
  cpm DECIMAL(8,2) DEFAULT 0,
  ctr DECIMAL(6,4) DEFAULT 0,
  roas DECIMAL(8,2) DEFAULT 0,
  cpa DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, platform, date)
);

-- Métricas diarias de Google Analytics
CREATE TABLE IF NOT EXISTS analytics_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  date DATE NOT NULL,
  users INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  conversion_rate DECIMAL(6,4) DEFAULT 0,
  add_to_cart_rate DECIMAL(6,4) DEFAULT 0,
  bounce_rate DECIMAL(6,4) DEFAULT 0,
  avg_session_duration DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, date)
);

-- Gastos manuales
CREATE TABLE IF NOT EXISTS finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cogs', 'shipping', 'handling_fees', 'payment_gateways', 'custom')),
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ad_accounts for their org"
  ON ad_accounts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage ad_accounts for their org"
  ON ad_accounts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view ad_metrics for their org"
  ON ad_metrics_daily FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage ad_metrics for their org"
  ON ad_metrics_daily FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view analytics_metrics for their org"
  ON analytics_metrics_daily FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage analytics_metrics for their org"
  ON analytics_metrics_daily FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view finance_expenses for their org"
  ON finance_expenses FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage finance_expenses for their org"
  ON finance_expenses FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_org_platform_date
  ON ad_metrics_daily(organization_id, platform, date);

CREATE INDEX IF NOT EXISTS idx_analytics_metrics_daily_org_date
  ON analytics_metrics_daily(organization_id, date);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_org_date
  ON finance_expenses(organization_id, date);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_org
  ON ad_accounts(organization_id);
