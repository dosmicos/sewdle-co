-- Route newly-created UGC discount links to the hidden Shopify favorites landing by default.
-- Existing links are intentionally untouched; rollout/rollback for existing links is managed by landing_variant batches.

ALTER TABLE ugc_discount_links
  ALTER COLUMN landing_enabled SET DEFAULT true,
  ALTER COLUMN landing_path SET DEFAULT '/pages/favoritos-ugc',
  ALTER COLUMN landing_variant SET DEFAULT 'favoritos_ugc_v1_default';
