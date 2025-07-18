
-- Limpiar duplicados en replenishment_suggestions para evitar duplicación en la vista
-- Eliminar sugerencias duplicadas del día actual, manteniendo solo una por variant
DELETE FROM public.replenishment_suggestions 
WHERE calculation_date = CURRENT_DATE 
AND id NOT IN (
  SELECT DISTINCT ON (product_variant_id) id 
  FROM public.replenishment_suggestions 
  WHERE calculation_date = CURRENT_DATE
  ORDER BY product_variant_id, created_at DESC
);

-- Limpiar todas las métricas de ventas para forzar una resincronización completa
DELETE FROM public.sales_metrics;
