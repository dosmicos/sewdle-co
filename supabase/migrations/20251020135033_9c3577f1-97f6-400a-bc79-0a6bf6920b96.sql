-- Add data_quality column to replenishment_suggestions
ALTER TABLE public.replenishment_suggestions 
ADD COLUMN IF NOT EXISTS data_quality TEXT DEFAULT 'medium';

ALTER TABLE public.replenishment_suggestions
ADD CONSTRAINT check_data_quality 
CHECK (data_quality IN ('high', 'medium', 'low', 'insufficient'));

COMMENT ON COLUMN public.replenishment_suggestions.data_quality IS 
  'high: historial completo de snapshots diarios, medium: datos inferidos de webhooks, low: estimado por fecha de creación, insufficient: sin datos suficientes para calcular';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_stock_history_variant_date 
ON public.product_stock_history(product_variant_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_stock_history_org_date 
ON public.product_stock_history(organization_id, recorded_at DESC);

COMMENT ON INDEX idx_product_stock_history_variant_date IS 'Optimize queries for days_with_stock calculation';
COMMENT ON INDEX idx_product_stock_history_org_date IS 'Optimize daily snapshot queries by organization';