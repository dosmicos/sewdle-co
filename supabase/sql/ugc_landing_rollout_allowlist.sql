-- UGC landing rollout allowlist helper
-- Purpose: gradually send only selected UGC links to the hidden Shopify landing.
-- Run only after Julian approval, the migration has been applied, ugc-redirect has been deployed,
-- and Shopify page /pages/favoritos-ugc exists in the live theme.

-- 1) Inspect current rollout state. Does not expose customer PII.
SELECT
  landing_enabled,
  landing_path,
  landing_variant,
  count(*) AS links
FROM ugc_discount_links
WHERE is_active = true
GROUP BY 1, 2, 3
ORDER BY landing_enabled DESC, links DESC;

-- 2) Activate a small allowlist first.
-- Replace TOKEN_1/TOKEN_2 with redirect_token values from the UGC links to test.
-- Keep this batch tiny at first: 1–3 creators.
UPDATE ugc_discount_links
SET landing_enabled = true,
    landing_path = '/pages/favoritos-ugc',
    landing_variant = 'favoritos_ugc_v1_batch_1',
    updated_at = now()
WHERE is_active = true
  AND redirect_token = ANY(ARRAY[
    'TOKEN_1',
    'TOKEN_2'
  ]);

-- 3) Verify exactly which tokens were enabled for this batch.
SELECT
  redirect_token,
  landing_enabled,
  landing_path,
  landing_variant,
  updated_at
FROM ugc_discount_links
WHERE landing_variant = 'favoritos_ugc_v1_batch_1'
ORDER BY updated_at DESC;

-- 4) Rollback only this batch if needed.
-- UPDATE ugc_discount_links
-- SET landing_enabled = false,
--     landing_variant = 'rollback_favoritos_ugc_v1_batch_1',
--     updated_at = now()
-- WHERE landing_variant = 'favoritos_ugc_v1_batch_1';

-- 5) Later batches can use new variants:
-- favoritos_ugc_v1_batch_2
-- favoritos_ugc_v1_batch_3
