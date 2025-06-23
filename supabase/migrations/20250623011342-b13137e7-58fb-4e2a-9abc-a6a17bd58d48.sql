
-- Crear tabla para logs de sincronización de inventario
CREATE TABLE public.inventory_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL,
  sync_results JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agregar índices para mejor rendimiento
CREATE INDEX idx_inventory_sync_logs_delivery_id ON public.inventory_sync_logs(delivery_id);
CREATE INDEX idx_inventory_sync_logs_synced_at ON public.inventory_sync_logs(synced_at);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.inventory_sync_logs ENABLE ROW LEVEL SECURITY;

-- Crear políticas de acceso - permitir lectura y escritura a usuarios autenticados
CREATE POLICY "Users can view inventory sync logs" 
  ON public.inventory_sync_logs 
  FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create inventory sync logs" 
  ON public.inventory_sync_logs 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);
