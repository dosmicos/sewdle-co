-- AngleOS fields for clearer sales-angle analysis in Sewdle Growth.
-- Adds a normalized layer between generic sales_angle and free-text hook_description.

ALTER TABLE ad_tags
  ADD COLUMN IF NOT EXISTS angle_family TEXT,
  ADD COLUMN IF NOT EXISTS specific_angle TEXT,
  ADD COLUMN IF NOT EXISTS hook_pattern TEXT,
  ADD COLUMN IF NOT EXISTS buyer_problem TEXT,
  ADD COLUMN IF NOT EXISTS desired_outcome TEXT,
  ADD COLUMN IF NOT EXISTS proof_type TEXT,
  ADD COLUMN IF NOT EXISTS angle_confidence TEXT CHECK (angle_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tags_angle_family ON ad_tags(organization_id, angle_family);
CREATE INDEX IF NOT EXISTS idx_tags_specific_angle ON ad_tags(organization_id, specific_angle);
CREATE INDEX IF NOT EXISTS idx_tags_hook_pattern ON ad_tags(organization_id, hook_pattern);
CREATE INDEX IF NOT EXISTS idx_tags_buyer_problem ON ad_tags(organization_id, buyer_problem);
CREATE INDEX IF NOT EXISTS idx_tags_proof_type ON ad_tags(organization_id, proof_type);
