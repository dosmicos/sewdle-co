-- Audit trail para auto-product-status-sync (activación/desactivación automática
-- de productos Shopify según inventario diario). Cada cambio que la edge function
-- aplique queda registrado aquí para ser revisado, revertido o reportado.

CREATE TABLE IF NOT EXISTS public.product_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_product_gid TEXT NOT NULL,
  shopify_product_id TEXT,
  product_title TEXT,
  action TEXT NOT NULL CHECK (action IN ('activated', 'deactivated', 'skipped', 'error')),
  reason TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  total_inventory INTEGER,
  has_images BOOLEAN,
  was_dry_run BOOLEAN NOT NULL DEFAULT false,
  triggered_by TEXT NOT NULL DEFAULT 'cron',
  error_message TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_status_audit_org_changed
  ON public.product_status_audit (organization_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_status_audit_product
  ON public.product_status_audit (shopify_product_gid, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_status_audit_action
  ON public.product_status_audit (action, changed_at DESC);

ALTER TABLE public.product_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_status_audit_select_own_org"
  ON public.product_status_audit
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.user_organizations
      WHERE user_id = auth.uid()
    )
  );

-- service_role escribe libremente (la edge function corre con service role)
CREATE POLICY "product_status_audit_service_insert"
  ON public.product_status_audit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.product_status_audit IS
  'Audit log para auto-product-status-sync edge function. Cada activación/desactivación automática queda registrada para revisión y rollback.';
