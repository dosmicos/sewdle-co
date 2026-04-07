-- Cron job: Sincronizar Meta Ads cada hora (7am-11pm Colombia = 12-04 UTC)
-- Trae datos del día actual para mantener ads activos actualizados

-- Asegurar extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Eliminar cron anterior si existe
SELECT cron.unschedule('sync-meta-ads-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-meta-ads-hourly'
);

-- Programar sync cada hora de 12:00 a 04:00 UTC (7am-11pm Colombia)
SELECT cron.schedule(
  'sync-meta-ads-hourly',
  '0 12-23,0-4 * * *',
  $$
  -- Para cada organización con cuenta Meta Ads activa, invocar sync
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-meta-ad-performance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'organizationId', aa.organization_id::text,
      'startDate', to_char(CURRENT_DATE, 'YYYY-MM-DD'),
      'endDate', to_char(CURRENT_DATE, 'YYYY-MM-DD')
    )
  )
  FROM ad_accounts aa
  WHERE aa.platform = 'meta'
    AND aa.is_active = true;
  $$
);
