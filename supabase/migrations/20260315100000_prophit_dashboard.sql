-- ============================================================
-- Prophit Dashboard: finance_settings, monthly_targets, marketing_events
-- ============================================================

-- 1. finance_settings — org-scoped manual inputs for contribution margin calculation
CREATE TABLE IF NOT EXISTS finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cogs_percent NUMERIC(5,2) DEFAULT 20.00,
  shipping_cost_percent NUMERIC(5,2) DEFAULT 10.00,
  payment_gateway_percent NUMERIC(5,2) DEFAULT 3.50,
  handling_cost_percent NUMERIC(5,2) DEFAULT 2.00,
  monthly_opex NUMERIC(14,2) DEFAULT 0,
  return_rate_percent NUMERIC(5,2) DEFAULT 5.00,
  cm_target_percent NUMERIC(5,2) DEFAULT 25.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT finance_settings_org_unique UNIQUE (organization_id)
);

ALTER TABLE finance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view finance_settings for their org"
  ON finance_settings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert finance_settings for their org"
  ON finance_settings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update finance_settings for their org"
  ON finance_settings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- 2. monthly_targets — monthly goals
CREATE TABLE IF NOT EXISTS monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  revenue_target NUMERIC(14,2) DEFAULT 0,
  cm_target NUMERIC(14,2) DEFAULT 0,
  ad_spend_budget NUMERIC(14,2) DEFAULT 0,
  new_customers_target INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT monthly_targets_org_month_unique UNIQUE (organization_id, month)
);

CREATE INDEX idx_monthly_targets_org_month ON monthly_targets(organization_id, month);

ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view monthly_targets for their org"
  ON monthly_targets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert monthly_targets for their org"
  ON monthly_targets FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update monthly_targets for their org"
  ON monthly_targets FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- 3. marketing_events — event annotations for chart overlays
CREATE TABLE IF NOT EXISTS marketing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT CHECK (event_type IN (
    'product_launch', 'promotion', 'email_campaign', 'sms_blast',
    'influencer_collab', 'pr_hit', 'organic_viral', 'cultural_moment',
    'price_change', 'new_creative_batch', 'channel_expansion', 'other'
  )),
  title TEXT NOT NULL,
  description TEXT,
  expected_impact TEXT CHECK (expected_impact IN ('high', 'medium', 'low')),
  actual_revenue_impact NUMERIC(14,2),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marketing_events_org_date ON marketing_events(organization_id, event_date);

ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view marketing_events for their org"
  ON marketing_events FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing_events for their org"
  ON marketing_events FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing_events for their org"
  ON marketing_events FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete marketing_events for their org"
  ON marketing_events FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );
