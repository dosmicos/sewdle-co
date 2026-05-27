-- Cron job: Sincronizar Google Ads cada hora (24/7, sin franja horaria)
-- Trae datos de los últimos 3 días para capturar correcciones retroactivas
-- (Google Ads, igual que TikTok/Meta, ajusta conversiones y costos por algunos días).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Limpiar versión previa si existe (idempotente)
SELECT cron.unschedule('sync-google-ads-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-google-ads-hourly'
);

SELECT cron.schedule(
  'sync-google-ads-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-google-ads',
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
  WHERE aa.platform = 'google_ads'
    AND aa.is_active = true;
  $$
);
