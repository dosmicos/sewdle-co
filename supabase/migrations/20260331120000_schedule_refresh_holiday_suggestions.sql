-- Schedule refresh-holiday-suggestions to run daily at 12:00 UTC (7:00 AM Colombia)
-- This will:
--   1. Auto-dismiss past holiday suggestions with status='suggested'
--   2. Regenerate suggestions for the current year via generate-holiday-suggestions

SELECT cron.schedule(
  'refresh-holiday-suggestions-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/refresh-holiday-suggestions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
