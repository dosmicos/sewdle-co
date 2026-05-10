-- Meta Ads sync health + Prophit freshness guardrails
-- Fixes the class of issue where a transient Meta API/OAuth error made Sewdle
-- show "Conectar Meta" and left Prophit's financial spend stale.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Track connection validity separately from sync health.
ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS needs_reconnect BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Track freshness of financial ad rows used by Prophit.
ALTER TABLE ad_metrics_daily
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

UPDATE ad_metrics_daily
SET synced_at = COALESCE(synced_at, created_at, now())
WHERE synced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_meta_sync_health
  ON ad_accounts (organization_id, platform, is_active, needs_reconnect, last_sync_at);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_platform_date_synced
  ON ad_metrics_daily (organization_id, platform, date, synced_at);

-- The old job name was misleading: it invoked sync-meta-ad-performance, not the
-- financial sync-meta-ads function that feeds ad_metrics_daily/Prophit.
SELECT cron.unschedule('sync-meta-ads-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ads-hourly');

SELECT cron.unschedule('sync-meta-ad-performance-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ad-performance-hourly');

-- Financial Meta spend for Prophit: sync a 7-day lookback every 30 minutes
-- during Dosmicos operating hours (7am-11pm Colombia). Use Bogotá calendar
-- dates explicitly; CURRENT_DATE in UTC can drift after 7pm Colombia.
SELECT cron.schedule(
  'sync-meta-ads-hourly',
  '*/30 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(((now() AT TIME ZONE 'America/Bogota')::date - 6), 'YYYY-MM-DD'),
      'endDate', to_char((now() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true
    AND COALESCE(aa.needs_reconnect, false) = false;
  $$
);

-- Ad-level performance: keep separate from the financial sync so a working
-- creative pipeline cannot mask stale Prophit spend again.
SELECT cron.schedule(
  'sync-meta-ad-performance-hourly',
  '15,45 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-performance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(((now() AT TIME ZONE 'America/Bogota')::date - 2), 'YYYY-MM-DD'),
      'endDate', to_char((now() AT TIME ZONE 'America/Bogota')::date, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true
    AND COALESCE(aa.needs_reconnect, false) = false;
  $$
);
