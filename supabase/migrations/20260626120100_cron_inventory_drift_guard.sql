-- Schedule the inventory drift guard daily at 10:00 UTC (05:00 BOG).
-- Runs after the BOG day fully closes (midnight BOG = 05:00 UTC) and after the
-- 00:00 UTC daily snapshot (cron jobid 6). apply mode writes inventory_drift_alerts.
-- Detection only — never mutates inventory.
select cron.schedule(
  'inventory-drift-guard-daily',
  '0 10 * * *',
  $$select public.run_inventory_drift_guard(
      ((now() at time zone 'America/Bogota')::date - 1),
      5, 10, false
   );$$
);
