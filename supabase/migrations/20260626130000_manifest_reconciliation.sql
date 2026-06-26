-- Reconciliación de manifiestos al entregar a la transportadora.
--
-- Endurece la entrega de paquetes al recolector para evitar paquetes perdidos:
--   1. Conteo del recolector vs. lo escaneado (todas las transportadoras).
--   2. Auditoría persistente de guías escaneadas que NO están en el manifiesto.
--   3. Cruce con la "relación de recogida" de Coordinadora (link/tirilla).
-- El "Confirmar Retiro" se bloquea ante descuadre salvo justificación registrada
-- (la regla de bloqueo se aplica en la app; aquí se persiste el resultado).

-- ── 1. Columnas de reconciliación en shipping_manifests ──────────────────────
ALTER TABLE public.shipping_manifests
  -- Nº de paquetes que dice el recolector que se lleva (manual; auto para Coordinadora).
  ADD COLUMN IF NOT EXISTS collector_reported_count INTEGER,
  -- Nombre del recolector (opcional; auto = nombre_empleado para Coordinadora).
  ADD COLUMN IF NOT EXISTS collector_name TEXT,
  -- Link de recogida pegado (solo Coordinadora por ahora).
  ADD COLUMN IF NOT EXISTS pickup_link_url TEXT,
  -- Estado del cruce: pending | matched | mismatch | overridden.
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT
    CHECK (reconciliation_status IN ('pending', 'matched', 'mismatch', 'overridden')),
  -- Payload normalizado de la transportadora + diffs calculados (para auditoría).
  ADD COLUMN IF NOT EXISTS reconciliation_data JSONB,
  -- Justificación cuando se fuerza el retiro pese a un descuadre.
  ADD COLUMN IF NOT EXISTS pickup_override_reason TEXT;

-- ── 2. Auditoría de guías escaneadas fuera del manifiesto ────────────────────
-- Hoy estas "extras" solo viven en estado de React y se pierden al cerrar.
-- 'gun'         = escaneada con la pistola pero no estaba en el manifiesto.
-- 'carrier_link'= aparece en la relación de la transportadora pero no en el manifiesto.
CREATE TABLE IF NOT EXISTS public.manifest_extra_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id UUID NOT NULL REFERENCES public.shipping_manifests(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'gun' CHECK (source IN ('gun', 'carrier_link')),
  scanned_at TIMESTAMPTZ DEFAULT now(),
  scanned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Una sola fila por (manifiesto, guía): re-escanear no duplica.
  UNIQUE (manifest_id, tracking_number)
);

CREATE INDEX IF NOT EXISTS idx_manifest_extra_scans_manifest
  ON public.manifest_extra_scans(manifest_id);

ALTER TABLE public.manifest_extra_scans ENABLE ROW LEVEL SECURITY;

-- RLS org-scoped vía EXISTS-join al manifiesto (mismo patrón que manifest_items).
CREATE POLICY "Users can view extra scans via manifest"
  ON public.manifest_extra_scans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.shipping_manifests sm
    WHERE sm.id = manifest_extra_scans.manifest_id
      AND sm.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Users can insert extra scans via manifest"
  ON public.manifest_extra_scans FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shipping_manifests sm
    WHERE sm.id = manifest_extra_scans.manifest_id
      AND sm.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Users can update extra scans via manifest"
  ON public.manifest_extra_scans FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.shipping_manifests sm
    WHERE sm.id = manifest_extra_scans.manifest_id
      AND sm.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Users can delete extra scans via manifest"
  ON public.manifest_extra_scans FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.shipping_manifests sm
    WHERE sm.id = manifest_extra_scans.manifest_id
      AND sm.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Service role full access to manifest_extra_scans"
  ON public.manifest_extra_scans FOR ALL
  USING (auth.role() = 'service_role');

-- ── 3. Backfill de total_verified ────────────────────────────────────────────
-- El hook mantiene total_verified; el frontend nuevo lo recalcula por conteo real
-- tras cada escaneo (evita la carrera del read-modify-write anterior) — ver
-- scanTrackingNumber en src/hooks/useShippingManifests.ts. No usamos un trigger
-- para no acoplar el orden de despliegue DB/frontend; esta migración es aditiva.
--
-- Backfill: corrige el total_verified histórico que pudo quedar desfasado por el
-- contador read-modify-write anterior, dejándolo igual al conteo real.
UPDATE public.shipping_manifests sm
   SET total_verified = sub.cnt
  FROM (
    SELECT manifest_id, COUNT(*) FILTER (WHERE scan_status = 'verified') AS cnt
      FROM public.manifest_items
     GROUP BY manifest_id
  ) sub
 WHERE sm.id = sub.manifest_id
   AND sm.total_verified IS DISTINCT FROM sub.cnt;
