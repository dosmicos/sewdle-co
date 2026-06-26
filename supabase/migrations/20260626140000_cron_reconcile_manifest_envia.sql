-- Cron diario que reconcilia los manifiestos contra el estado real en Envia:
--   • guías con movimiento (entregadas, en tránsito, etc.) → 'verified'
--   • guías canceladas en Envia                            → 'canceled' (no cuentan)
-- y recalcula los conteos (total_verified / total_packages efectivas).
--
-- Corre 10:30 UTC (5:30 AM Colombia), después de los demás jobs de las 10:00.
-- Llama la edge function en modo apply con la service_role_key del vault — la
-- escritura SOLO está permitida para el rol service_role (mismo patrón que
-- auto-product-status-sync).
select cron.schedule(
  'reconcile-manifest-envia-daily',
  '30 10 * * *',
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
