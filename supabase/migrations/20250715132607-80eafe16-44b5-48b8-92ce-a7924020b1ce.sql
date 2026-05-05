-- Habilitar extensiones necesarias para cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar cron job para reposición inteligente
-- Se ejecuta cada miércoles a las 8:00 AM UTC (3 = miércoles, 0-6 donde 0=domingo)
SELECT cron.schedule(
  'intelligent-replenishment-weekly',
  '0 8 * * 3', -- Cada miércoles a las 8 AM
  $$
  SELECT
    net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/intelligent-replenishment',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
        body:='{"scheduled": true, "execution_time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);

-- Función para ejecutar manualmente el cálculo de reposición
CREATE OR REPLACE FUNCTION public.trigger_replenishment_calculation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Ejecutar cálculo de reposición
  SELECT to_jsonb(calculate_replenishment_suggestions.*) INTO result
  FROM calculate_replenishment_suggestions()
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cálculo de reposición ejecutado manualmente',
    'timestamp', now(),
    'sample_result', result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;