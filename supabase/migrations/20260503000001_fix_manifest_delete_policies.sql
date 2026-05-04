-- Fix manifest delete policies to allow deleting manifests of ANY status.
-- Previously, the policy restricted deletion to status = 'open' only,
-- causing silent failures (no error, but nothing deleted) for closed/picked_up manifests.

-- 1. shipping_manifests: allow delete regardless of status
DROP POLICY IF EXISTS "Users can delete open manifests in their organization" ON shipping_manifests;

CREATE POLICY "Users can delete manifests in their organization"
ON shipping_manifests FOR DELETE
USING (organization_id = get_current_organization_safe());

-- 2. manifest_items: allow delete when the parent manifest belongs to the user's org
--    (previously also required status = 'open')
DROP POLICY IF EXISTS "Users can delete manifest items from open manifests" ON manifest_items;

CREATE POLICY "Users can delete manifest items in their organization"
ON manifest_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM shipping_manifests sm
  WHERE sm.id = manifest_items.manifest_id
  AND sm.organization_id = get_current_organization_safe()
));
