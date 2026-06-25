-- Dispara auto-product-status-sync todos los días a las 5:00 AM Colombia (10:00 UTC).
-- Reemplaza la dependencia de una "scheduled routine" externa que no estaba surtiendo
-- efecto. Corre en modo LIVE vía body (dry_run=false), sin depender del secret
-- AUTO_PRODUCT_STATUS_DRY_RUN. Mismo patrón que notify-back-in-stock / landing-ab-verdict.
select cron.schedule(
  'auto-product-status-sync-daily',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/auto-product-status-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
      )
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron', 'dry_run', false),
    timeout_milliseconds := 150000
  );
  $$
);
