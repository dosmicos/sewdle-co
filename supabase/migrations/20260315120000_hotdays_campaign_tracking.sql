-- Track which customers have been sent a campaign message (to avoid duplicates)
CREATE TABLE IF NOT EXISTS hotdays_campaign_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  phone TEXT NOT NULL,
  tag TEXT NOT NULL, -- which tag triggered this send (HotDays, hotdays2, etc.)
  template_name TEXT NOT NULL,
  shopify_customer_id BIGINT,
  customer_name TEXT,
  customer_email TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  whatsapp_message_id TEXT,
  UNIQUE(organization_id, phone, tag)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_hotdays_campaign_sent_org_tag
  ON hotdays_campaign_sent(organization_id, tag);
CREATE INDEX IF NOT EXISTS idx_hotdays_campaign_sent_phone
  ON hotdays_campaign_sent(organization_id, phone);

-- RLS
ALTER TABLE hotdays_campaign_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on hotdays_campaign_sent"
  ON hotdays_campaign_sent
  FOR ALL
  USING (true)
  WITH CHECK (true);
