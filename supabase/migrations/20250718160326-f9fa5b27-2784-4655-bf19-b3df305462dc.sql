
-- Crear tabla para control de sincronizaciones
CREATE TABLE IF NOT EXISTS public.sync_control_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type TEXT NOT NULL, -- 'initial', 'daily', 'monthly'
  sync_mode TEXT NOT NULL, -- 'sales', 'replenishment'
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_time TIMESTAMP WITH TIME ZONE,
  days_processed INTEGER NOT NULL DEFAULT 0,
  orders_processed INTEGER NOT NULL DEFAULT 0,
  variants_updated INTEGER NOT NULL DEFAULT 0,
  metrics_created INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  execution_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_sync_control_type_mode ON public.sync_control_logs(sync_type, sync_mode);
CREATE INDEX IF NOT EXISTS idx_sync_control_status ON public.sync_control_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_control_start_time ON public.sync_control_logs(start_time DESC);

-- Habilitar RLS
ALTER TABLE public.sync_control_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso completo a usuarios autenticados
CREATE POLICY "Allow full access to authenticated users" 
  ON public.sync_control_logs 
  FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Actualizar el cron job existente para usar el nuevo sistema
-- Primero eliminar el job existente
SELECT cron.unschedule('intelligent-replenishment-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'intelligent-replenishment-weekly'
);

-- Cron job para sincronización diaria de ventas (7 días) - 6:00 AM UTC
SELECT cron.schedule(
  'sync-shopify-sales-daily',
  '0 6 * * *', -- Diario a las 6 AM
  $$
  SELECT
    net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-sales',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
        body:='{"mode": "daily", "days": 7, "scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Cron job para sincronización mensual de ventas (30 días) - día 1 de cada mes a las 8:00 AM UTC
SELECT cron.schedule(
  'sync-shopify-sales-monthly',
  '0 8 1 * *', -- Día 1 de cada mes a las 8 AM
  $$
  SELECT
    net.http_post(
        url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/sync-shopify-sales',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
        body:='{"mode": "monthly", "days": 30, "scheduled": true}'::jsonb
    ) as request_id;
  $$
);

-- Cron job para cálculo de reposición inteligente (mantener semanal) - miércoles 8:00 AM UTC
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

-- Función para verificar si hay una sincronización en progreso
CREATE OR REPLACE FUNCTION public.is_sync_in_progress(sync_type_param text, sync_mode_param text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sync_control_logs 
    WHERE sync_type = sync_type_param 
    AND sync_mode = sync_mode_param 
    AND status = 'running'
    AND start_time > now() - INTERVAL '2 hours' -- timeout después de 2 horas
  );
END;
$$;
