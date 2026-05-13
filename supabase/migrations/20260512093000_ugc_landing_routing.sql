-- Add optional UGC landing routing controls.
-- Keeps published creator links stable while allowing a hidden Shopify landing per link/campaign.

ALTER TABLE ugc_discount_links
  ADD COLUMN IF NOT EXISTS landing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS landing_variant text;

ALTER TABLE ugc_discount_links
  ADD CONSTRAINT ugc_discount_links_landing_path_safe
  CHECK (landing_path IS NULL OR (landing_path LIKE '/%' AND landing_path NOT LIKE '//%'));

CREATE INDEX IF NOT EXISTS idx_ugc_discount_links_landing_enabled
  ON ugc_discount_links(landing_enabled)
  WHERE landing_enabled = true;
