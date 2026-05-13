-- UGC Discount Links — Landing Page Condicional
-- Permite configurar una landing page de destino por link.
-- DEFAULT false garantiza cero cambio de comportamiento para links existentes.

ALTER TABLE public.ugc_discount_links
  ADD COLUMN IF NOT EXISTS landing_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS landing_path    text,
  ADD COLUMN IF NOT EXISTS landing_variant text;

-- Prevenir URLs externas almacenadas en landing_path (solo rutas relativas)
ALTER TABLE public.ugc_discount_links
  ADD CONSTRAINT ugc_discount_links_landing_path_relative_check
  CHECK (landing_path IS NULL OR landing_path LIKE '/%');
