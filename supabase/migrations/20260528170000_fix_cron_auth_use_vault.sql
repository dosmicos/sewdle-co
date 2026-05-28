-- Fix: pg_cron jobs to sync ads (Meta, TikTok, Google) were silently failing
-- because they used current_setting('supabase.service_role_key', true) which
-- returns NULL on modern Supabase projects. That sent `Authorization: Bearer `
-- (empty Bearer) → Supabase API Gateway rejected with 401 → request never
-- reached the edge function (no logs, no writes to ad_metrics_daily).
--
-- Symptoms seen in production:
--   - cron.job_run_details showed status='succeeded' (the SQL itself ran fine,
--     net.http_post just got a 401 response — which still counts as "ran")
--   - supabase functions logs for sync-tiktok-ads / sync-meta-ads-spend /
--     sync-google-ads were empty
--   - ad_metrics_daily for tiktok_ads had no new rows for >24h
--
-- Fix: read the service_role_key from Vault. This requires the secret to have
-- been created beforehand via:
--     SELECT vault.create_secret('<service_role_key>', 'service_role_key', '...');
--
-- That step is done manually (the key cannot live in source control). This
-- migration is idempotent — it will replace any existing schedules with the
-- corrected versions.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sanity check: refuse to apply if the vault secret is missing, otherwise
-- the cron will keep silently failing and we'd think it works.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key'
  ) THEN
    RAISE EXCEPTION
      'Vault secret named "service_role_key" not found. Create it first with: SELECT vault.create_secret(''<key>'', ''service_role_key'', ''description'');';
  END IF;
END $$;

-- ─── 1) Meta Ads — sync-meta-ads-spend (7am-11pm Colombia) ─────────────
SELECT cron.unschedule('sync-meta-ads-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ads-hourly');

SELECT cron.schedule(
  'sync-meta-ads-hourly',
  '0 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ads-spend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE - INTERVAL '3 days', 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta_ads' AND aa.is_active = true;
  $$
);

-- ─── 2) TikTok Ads — sync-tiktok-ads (7am-11pm Colombia) ───────────────
SELECT cron.unschedule('sync-tiktok-ads-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-tiktok-ads-hourly');

SELECT cron.schedule(
  'sync-tiktok-ads-hourly',
  '0 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-tiktok-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE - INTERVAL '3 days', 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'tiktok_ads' AND aa.is_active = true;
  $$
);

-- ─── 3) Google Ads — sync-google-ads (24/7, per user request) ─────────
SELECT cron.unschedule('sync-google-ads-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-google-ads-hourly');

SELECT cron.schedule(
  'sync-google-ads-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-google-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE - INTERVAL '3 days', 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'google_ads' AND aa.is_active = true;
  $$
);
