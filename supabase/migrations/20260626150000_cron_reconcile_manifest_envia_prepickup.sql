-- Reprograma el cron de reconciliación de manifiestos para que corra DOS veces al
-- día, justo antes de que lleguen las transportadoras: 4:00 PM y 5:00 PM Colombia.
-- Colombia es UTC-5 (sin horario de verano) → 21:00 y 22:00 UTC.
-- Reemplaza el horario único de las 5:30 AM (migración 20260626140000).
-- cron.schedule con el mismo nombre actualiza el job existente (no lo duplica).
select cron.schedule(
  'reconcile-manifest-envia-daily',
  '0 21,22 * * *',
  $$
  select net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/reconcile-manifest-envia-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
      )
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron', 'apply', true),
    timeout_milliseconds := 150000
  );
  $$
);
