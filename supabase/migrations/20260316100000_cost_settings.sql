-- Cost Settings Module: per-product COGS, gateway costs, enhanced expenses
-- Mirrors Triple Whale's cost-settings pattern

-- 1. Product-level costs (synced from Shopify + manual overrides)
CREATE TABLE IF NOT EXISTS product_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  product_id BIGINT NOT NULL,
  variant_id BIGINT,
  title TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(14,2) DEFAULT 0,
  product_cost NUMERIC(14,2) DEFAULT 0,
  handling_fee NUMERIC(14,2) DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK (source IN ('shopify', 'manual')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_costs ADD CONSTRAINT product_costs_org_product_variant_unique
  UNIQUE(organization_id, product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_product_costs_org ON product_costs(organization_id);

ALTER TABLE product_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_costs_org_policy ON product_costs
  FOR ALL USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
    )
  );

-- 2. Gateway cost configuration
CREATE TABLE IF NOT EXISTS gateway_cost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  gateway_name TEXT NOT NULL,
  percent_fee NUMERIC(5,2) DEFAULT 0,
  flat_fee NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, gateway_name)
);

CREATE INDEX IF NOT EXISTS idx_gateway_costs_org ON gateway_cost_settings(organization_id);

ALTER TABLE gateway_cost_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY gateway_costs_org_policy ON gateway_cost_settings
  FOR ALL USING (
    organization_id IN (
      SELECT ou.organization_id FROM organization_users ou
      WHERE ou.user_id = auth.uid()
    )
  );

-- 3. Extend finance_settings with cost mode flags + shipping cost per order
ALTER TABLE finance_settings
  ADD COLUMN IF NOT EXISTS cogs_mode TEXT DEFAULT 'per_product' CHECK (cogs_mode IN ('percent', 'per_product')),
  ADD COLUMN IF NOT EXISTS shipping_mode TEXT DEFAULT 'per_order_cost' CHECK (shipping_mode IN ('percent', 'shopify_charges', 'per_order_cost')),
  ADD COLUMN IF NOT EXISTS gateway_mode TEXT DEFAULT 'percent' CHECK (gateway_mode IN ('percent', 'per_gateway')),
  ADD COLUMN IF NOT EXISTS shipping_cost_per_order NUMERIC(10,2) DEFAULT 0;

-- 4. Extend finance_expenses for recurring expense support
ALTER TABLE finance_expenses
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'weekly', 'daily', 'one_time')),
  ADD COLUMN IF NOT EXISTS is_ad_spend BOOLEAN DEFAULT false;
