-- Fix: Sync last 3 days instead of just today to capture delayed Meta attributions
-- Meta can update attribution data up to 7 days after the event, so syncing
-- the last 3 days ensures recent conversions are not missed.

-- Remove existing cron job
SELECT cron.unschedule('sync-meta-ads-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ads-hourly'
);

-- Re-create with 3-day lookback window (CURRENT_DATE - 2 to CURRENT_DATE)
SELECT cron.schedule(
  'sync-meta-ads-hourly',
  '0 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-performance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE - 2, 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);
