-- Carritos abandonados por WhatsApp (MVP)
-- Formaliza tabla shopify_carts (existe en types.ts pero no estaba trackeada),
-- agrega columnas necesarias para recovery, crea cart_recovery_attempts,
-- aplica RLS org-scoped y agenda cron de envios cada 5 minutos.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================================
-- 1. shopify_carts: formalizar y extender
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.shopify_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_cart_token TEXT NOT NULL,
  contact_id UUID,
  line_items JSONB,
  total_price NUMERIC,
  shopify_created_at TIMESTAMPTZ,
  is_abandoned BOOLEAN NOT NULL DEFAULT false,
  abandoned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shopify_carts
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_first_name TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_price NUMERIC,
  ADD COLUMN IF NOT EXISTS recovery_url TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_order_id UUID REFERENCES public.shopify_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_message_step INT,
  ADD COLUMN IF NOT EXISTS last_message_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_carts_token_org
  ON public.shopify_carts (shopify_cart_token, organization_id);

CREATE INDEX IF NOT EXISTS idx_shopify_carts_recovery_eligible
  ON public.shopify_carts (shopify_created_at, organization_id)
  WHERE recovered_at IS NULL
    AND opted_out = false
    AND last_message_step IS NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_carts_phone
  ON public.shopify_carts (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_carts_email
  ON public.shopify_carts (lower(email))
  WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.shopify_carts_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopify_carts_updated_at ON public.shopify_carts;
CREATE TRIGGER trg_shopify_carts_updated_at
  BEFORE UPDATE ON public.shopify_carts
  FOR EACH ROW EXECUTE FUNCTION public.shopify_carts_set_updated_at();

ALTER TABLE public.shopify_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopify_carts_select_by_org" ON public.shopify_carts;
CREATE POLICY "shopify_carts_select_by_org"
  ON public.shopify_carts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "shopify_carts_service_role_all" ON public.shopify_carts;
CREATE POLICY "shopify_carts_service_role_all"
  ON public.shopify_carts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 2. cart_recovery_attempts: auditoria de envios
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.cart_recovery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.shopify_carts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step INT NOT NULL,
  template_name TEXT NOT NULL,
  whatsapp_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_recovery_attempts_cart
  ON public.cart_recovery_attempts (cart_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_cart_recovery_attempts_org_sent
  ON public.cart_recovery_attempts (organization_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_cart_recovery_attempts_message_id
  ON public.cart_recovery_attempts (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

ALTER TABLE public.cart_recovery_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_recovery_attempts_select_by_org" ON public.cart_recovery_attempts;
CREATE POLICY "cart_recovery_attempts_select_by_org"
  ON public.cart_recovery_attempts FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cart_recovery_attempts_service_role_all" ON public.cart_recovery_attempts;
CREATE POLICY "cart_recovery_attempts_service_role_all"
  ON public.cart_recovery_attempts FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- =====================================================================
-- 3. pg_cron: invocar cart-recovery-send cada 5 minutos
-- =====================================================================

SELECT cron.unschedule('cart-recovery-send')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cart-recovery-send');

SELECT cron.schedule(
  'cart-recovery-send',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/cart-recovery-send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);

COMMENT ON TABLE public.shopify_carts IS
  'Carritos / checkouts de Shopify (incluye los abandonados). Sembrada via webhooks checkouts/create y checkouts/update. Marcada como recovered cuando llega orders/create matching cart_token o email/phone.';

COMMENT ON TABLE public.cart_recovery_attempts IS
  'Auditoria de mensajes de WhatsApp enviados para recuperar carritos abandonados. Una fila por mensaje (step 1 en MVP).';
