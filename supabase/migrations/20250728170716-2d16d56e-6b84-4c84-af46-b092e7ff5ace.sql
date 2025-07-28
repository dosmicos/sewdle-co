-- Limpiar datos corruptos de sales_metrics para 2025-07-27
-- Esto eliminará las métricas incorrectas donde orders_count está inflado
-- debido al bug de contar cada line_item como una orden separada

DELETE FROM public.sales_metrics 
WHERE metric_date = '2025-07-27';

-- Log de la operación para auditoría
INSERT INTO public.sync_control_logs (
  sync_type,
  sync_mode, 
  status,
  start_time,
  end_time,
  error_message
) VALUES (
  'data_cleanup',
  'manual',
  'completed',
  now(),
  now(),
  'Eliminadas métricas corruptas del 2025-07-27 debido a bug de orders_count duplicado'
);