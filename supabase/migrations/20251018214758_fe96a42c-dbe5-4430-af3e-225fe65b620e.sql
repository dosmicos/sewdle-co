-- Limpiar duplicados existentes (mantener solo el más reciente)
DELETE FROM public.replenishment_suggestions a
USING public.replenishment_suggestions b
WHERE a.id < b.id
  AND a.product_variant_id = b.product_variant_id
  AND a.calculation_date = b.calculation_date
  AND a.organization_id = b.organization_id;

-- Crear constraint único para evitar duplicados
ALTER TABLE public.replenishment_suggestions
ADD CONSTRAINT replenishment_suggestions_variant_date_org_unique
UNIQUE (product_variant_id, calculation_date, organization_id);

-- Crear índice para mejorar performance
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_variant_date
ON public.replenishment_suggestions(product_variant_id, calculation_date);