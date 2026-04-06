-- Cron jobs: Actualizar UGC Performance cada hora (7am-11pm Colombia = 12-04 UTC)
-- 1. sync-meta-ad-creative: sincroniza creativos y detecta handles UGC desde nombres de ads
-- 2. compute-ugc-scores: recalcula scores, tiers y recomendaciones de creadoras UGC

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Job 1: Sync Meta Ad Creative (cada hora en punto) ───────────────────

SELECT cron.unschedule('sync-meta-ad-creative-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ad-creative-hourly'
);

SELECT cron.schedule(
  'sync-meta-ad-creative-hourly',
  '5 12-23,0-4 * * *',
  $$
  -- Para cada organización con cuenta Meta Ads activa, sincronizar creativos
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-creative',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);

-- ─── Job 2: Compute UGC Scores (15 min después del sync de creativos) ───

SELECT cron.unschedule('compute-ugc-scores-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'compute-ugc-scores-hourly'
);

SELECT cron.schedule(
  'compute-ugc-scores-hourly',
  '20 12-23,0-4 * * *',
  $$
  -- Para cada organización con cuenta Meta Ads activa, recalcular scores UGC
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/compute-ugc-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);
