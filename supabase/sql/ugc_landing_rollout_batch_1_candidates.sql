-- UGC landing rollout — batch 1 candidates
-- Prepared by Nova. DO NOT RUN before Julian approves production rollout.
-- This does not expose redirect tokens; it selects active links by creator Instagram handle.

-- Batch 1 rationale:
-- 1) @nanis8a — active, 5% link, highest current attributed orders/revenue in UGC links.
-- 2) @adritoro — active, 5% link, second-highest current attributed orders/revenue.
-- 3) @carolinaavellaneda98 — active, 5% link, has attributed order + clear IG handle; small enough for controlled QA.

BEGIN;

WITH selected_creators AS (
  SELECT id, name, instagram_handle
  FROM ugc_creators
  WHERE lower(instagram_handle) IN (
    'nanis8a',
    'adritoro',
    'carolinaavellaneda98'
  )
), updated_links AS (
  UPDATE ugc_discount_links dl
  SET landing_enabled = true,
      landing_path = '/pages/favoritos-ugc',
      landing_variant = 'favoritos_ugc_v1_batch_1',
      updated_at = now()
  FROM selected_creators c
  WHERE dl.creator_id = c.id
    AND dl.is_active = true
    AND dl.discount_value = 5
  RETURNING
    dl.id,
    dl.creator_id,
    c.name AS creator_name,
    c.instagram_handle,
    dl.landing_enabled,
    dl.landing_path,
    dl.landing_variant,
    dl.updated_at
)
SELECT * FROM updated_links
ORDER BY creator_name;

-- Keep this transaction open until the result shows exactly 3 rows.
-- If it returns anything other than exactly 3 rows, run ROLLBACK.
-- If it returns exactly these 3 creators, run COMMIT.

-- COMMIT;
-- ROLLBACK;

-- Rollback after commit, if QA fails:
-- UPDATE ugc_discount_links dl
-- SET landing_enabled = false,
--     landing_variant = 'rollback_favoritos_ugc_v1_batch_1',
--     updated_at = now()
-- FROM ugc_creators c
-- WHERE dl.creator_id = c.id
--   AND lower(c.instagram_handle) IN ('nanis8a', 'adritoro', 'carolinaavellaneda98')
--   AND dl.landing_variant = 'favoritos_ugc_v1_batch_1';
