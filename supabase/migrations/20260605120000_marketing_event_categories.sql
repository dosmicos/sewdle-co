-- ─── marketing_event_categories ─────────────────────────────────────
-- Org-customizable activity types for the Marketing Calendar. Until now the
-- 12 types (label + color) were hardcoded in the frontend; this table lets
-- each org rename them, recolor them (free hex), add new ones, reorder, and
-- hide the ones they don't use.
--
-- An event's marketing_events.event_type stores the category `key`. The 12
-- built-ins keep their original keys (product_launch, promotion, ...) so all
-- existing events keep resolving to a label + color with no data migration.

CREATE TABLE IF NOT EXISTS marketing_event_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                 -- stable slug stored in marketing_events.event_type
  label TEXT NOT NULL,
  color TEXT NOT NULL,               -- free hex color, e.g. '#a855f7'
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- hidden types stay valid for existing events
  is_builtin BOOLEAN NOT NULL DEFAULT FALSE, -- built-ins can be renamed/recolored/hidden but not deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_marketing_event_categories_org
  ON marketing_event_categories (organization_id, sort_order);

ALTER TABLE marketing_event_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view marketing_event_categories for their org"
  ON marketing_event_categories FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert marketing_event_categories for their org"
  ON marketing_event_categories FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update marketing_event_categories for their org"
  ON marketing_event_categories FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete marketing_event_categories for their org"
  ON marketing_event_categories FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
    )
  );

-- Seed the 12 built-ins for every existing organization (hex = the Tailwind
-- -500 shades the frontend used before). Idempotent via the unique key.
INSERT INTO marketing_event_categories (organization_id, key, label, color, sort_order, is_builtin)
SELECT o.id, d.key, d.label, d.color, d.sort_order, TRUE
FROM organizations o
CROSS JOIN (VALUES
  ('product_launch',     'Lanzamiento', '#a855f7', 0),
  ('promotion',          'Promocion',   '#ef4444', 1),
  ('email_campaign',     'Email',       '#3b82f6', 2),
  ('sms_blast',          'SMS',         '#22c55e', 3),
  ('influencer_collab',  'Influencer',  '#ec4899', 4),
  ('pr_hit',             'PR',          '#eab308', 5),
  ('organic_viral',      'Viral',       '#10b981', 6),
  ('cultural_moment',    'Cultural',    '#f97316', 7),
  ('price_change',       'Precio',      '#6366f1', 8),
  ('new_creative_batch', 'Creativo',    '#06b6d4', 9),
  ('channel_expansion',  'Canal',       '#14b8a6', 10),
  ('other',              'Otro',        '#6b7280', 11)
) AS d(key, label, color, sort_order)
ON CONFLICT (organization_id, key) DO NOTHING;

-- Allow custom (non-built-in) event_type keys now that types are org-defined.
-- The old CHECK only permitted the 12 hardcoded values, which would reject any
-- newly created custom type.
ALTER TABLE marketing_events DROP CONSTRAINT IF EXISTS marketing_events_event_type_check;
