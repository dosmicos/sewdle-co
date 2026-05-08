-- Allow manifest_items to reference external shipments (created in carrier portals,
-- not via our app) that have no corresponding shipping_labels record in our DB.
-- Without this, manifests created from Envia API data (portal-only labels) silently
-- drop all guides that lack a DB record, resulting in empty or partial manifests.

-- 1. Make shipping_label_id nullable (external labels won't have a DB record)
ALTER TABLE manifest_items
  ALTER COLUMN shipping_label_id DROP NOT NULL;

-- 2. Drop the unique index on shipping_label_id entirely.
--    The original index prevented the same guide from appearing in more than one manifest,
--    but users need to be able to create multiple manifests with the same guides
--    (e.g. correcting a mistake or splitting shipments). The uniqueness constraint
--    is replaced by idx_manifest_items_unique_tracking below (per-manifest uniqueness).
DROP INDEX IF EXISTS idx_manifest_items_unique_label;

-- 4. Make shopify_order_id nullable (external portal labels may not link to a Shopify order)
ALTER TABLE manifest_items
  ALTER COLUMN shopify_order_id DROP NOT NULL;

-- 5. Make order_number nullable (same reason — external labels may not have an order number)
ALTER TABLE manifest_items
  ALTER COLUMN order_number DROP NOT NULL;

-- 6. Add a unique constraint on (manifest_id, tracking_number) to prevent duplicate
--    tracking numbers within a single manifest (works for both DB-backed and external items)
CREATE UNIQUE INDEX IF NOT EXISTS idx_manifest_items_unique_tracking
  ON manifest_items(manifest_id, tracking_number);
