-- Cron job: Sincronizar TikTok Ads cada hora (7am-11pm Colombia = 12-04 UTC)
-- Trae datos de los ultimos 3 dias (TikTok tiene reporting delay y revisions retroactivas)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('sync-tiktok-ads-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-tiktok-ads-hourly'
);

SELECT cron.schedule(
  'sync-tiktok-ads-hourly',
  '0 12-23,0-4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-tiktok-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE - INTERVAL '3 days', 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'tiktok_ads'
    AND aa.is_active = true;
  $$
);
