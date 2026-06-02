-- Fix: the daily Shopify sales sync at 6am UTC was firing without an
-- `organization_id` in its body, so sync-shopify-sales fell into the legacy
-- ENV-var single-store fallback instead of iterating over the multi-store
-- setup driven by the `stores` table. Combined with the once-per-day cadence
-- and pure-webhook gap-filling, this is the most plausible source of the
-- ~15% Net Sales delta the user saw between Shopify "Total sales over time"
-- and growth.sewdle.co for the same day.
--
-- This migration:
--   1. Unschedules the old `sync-shopify-sales-daily` job.
--   2. Creates `sync-shopify-sales-hourly` that runs once per hour and emits
--      one HTTP POST per active store, each scoped to its `organization_id`.
--      sync-shopify-sales then walks the right rows in `stores` and pulls
--      the last 2 days of orders for that org.
--   3. Uses the vault.decrypted_secrets pattern for the bearer token —
--      same auth fix shipped for the Meta/TikTok/Google ad-sync crons.
--      Requires the `service_role_key` vault secret to exist (created in
--      a prior session).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key'
  ) THEN
    RAISE EXCEPTION
      'Vault secret named "service_role_key" not found. Seed it with: SELECT vault.create_secret(''<jwt>'', ''service_role_key'', ''description'');';
  END IF;
END $$;

-- Retire the broken daily job (also harmless if absent).
SELECT cron.unschedule('sync-shopify-sales-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-shopify-sales-daily');

-- Retire any earlier attempts at this exact name so the migration is idempotent.
SELECT cron.unschedule('sync-shopify-sales-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-shopify-sales-hourly');

-- New hourly sync: one POST per active store, each scoped to its organization.
-- Day cadence stays at "last 2 days" so we always overlap the previous run and
-- catch any partial-day inserts. sync-shopify-sales is idempotent (upsert on
-- shopify_order_id).
SELECT cron.schedule(
  'sync-shopify-sales-hourly',
  '7 * * * *',  -- off-the-hour to avoid the :00 thundering herd
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-sales',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'mode', 'daily',
      'days', 2,
      'scheduled', true,
      'organization_id', s.organization_id::text,
      'store_id', s.id::text
    )
  )
  FROM stores s
  WHERE s.is_active = true
    AND s.shopify_credentials IS NOT NULL
    AND (s.shopify_credentials->>'access_token') IS NOT NULL;
  $$
);
