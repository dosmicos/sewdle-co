-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily inventory snapshot at midnight UTC
SELECT cron.schedule(
  'daily-inventory-snapshot',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/snapshot-daily-inventory',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);