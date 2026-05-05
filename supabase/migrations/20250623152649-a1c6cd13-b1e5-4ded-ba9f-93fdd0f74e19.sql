
-- Crear tabla para logs de asignación de SKUs con persistencia de progreso
CREATE TABLE public.sku_assignment_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'running',
  total_products INTEGER DEFAULT 0,
  total_variants INTEGER DEFAULT 0,
  processed_variants INTEGER DEFAULT 0,
  updated_variants INTEGER DEFAULT 0,
  skipped_variants INTEGER DEFAULT 0,
  error_variants INTEGER DEFAULT 0,
  current_cursor TEXT,
  last_processed_product_id TEXT,
  last_processed_variant_id TEXT,
  shopify_api_calls INTEGER DEFAULT 0,
  rate_limit_hits INTEGER DEFAULT 0,
  error_message TEXT,
  detailed_results JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para mejor performance
CREATE INDEX idx_sku_logs_process_id ON public.sku_assignment_logs(process_id);
CREATE INDEX idx_sku_logs_status ON public.sku_assignment_logs(status);
CREATE INDEX idx_sku_logs_started_at ON public.sku_assignment_logs(started_at DESC);

-- Habilitar RLS
ALTER TABLE public.sku_assignment_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir acceso completo a usuarios autenticados
CREATE POLICY "Allow full access to authenticated users" 
  ON public.sku_assignment_logs 
  FOR ALL 
  USING (auth.uid() IS NOT NULL);

-- Función para limpiar logs antiguos (opcional)
CREATE OR REPLACE FUNCTION public.cleanup_old_sku_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Eliminar logs completados más antiguos de 30 días
  DELETE FROM public.sku_assignment_logs 
  WHERE status IN ('completed', 'failed') 
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;
