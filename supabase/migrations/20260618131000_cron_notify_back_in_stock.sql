-- Daily cron for the "back-in-stock" notifier. Fires notify-back-in-stock once a
-- day; that function iterates pending back_in_stock_subscriptions across all orgs,
-- checks current inventory, and sends a WhatsApp template when a variant is back.
-- Uses the vault.decrypted_secrets bearer pattern (same as the other crons).
-- Requires the `service_role_key` vault secret to exist (seeded in a prior session).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key'
  ) THEN
    RAISE EXCEPTION
      'Vault secret named "service_role_key" not found. Seed it with: SELECT vault.create_secret(''<jwt>'', ''service_role_key'', ''description'');';
  END IF;
END $$;

-- Idempotent: retire any earlier version of this job.
SELECT cron.unschedule('notify-back-in-stock-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-back-in-stock-daily');

-- 14:00 UTC ≈ 9:00 a.m. Bogotá.
SELECT cron.schedule(
  'notify-back-in-stock-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/notify-back-in-stock',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := jsonb_build_object('mode', 'daily', 'scheduled', true)
  );
  $$
);
