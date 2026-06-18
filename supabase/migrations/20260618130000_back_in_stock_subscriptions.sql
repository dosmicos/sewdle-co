-- Back-in-stock subscriptions: when a customer asks to be notified about an
-- out-of-stock product, Elsa stores a row here. A daily cron (notify-back-in-stock)
-- crosses pending rows against current inventory and sends a WhatsApp template
-- when the variant is available again.

CREATE TABLE IF NOT EXISTS public.back_in_stock_subscriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id   uuid REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  channel_id        uuid REFERENCES public.messaging_channels(id) ON DELETE SET NULL,
  customer_phone    text NOT NULL,           -- = messaging_conversations.external_user_id (WhatsApp number)
  customer_name     text,
  product_id        text,                    -- Shopify product id (from the catalog Elsa sees)
  variant_sku       text,                    -- preferred join key against product_variants.sku_variant
  product_name      text NOT NULL,
  size              text,
  color             text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','notified','cancelled','expired')),
  notified_at       timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bis_org_status
  ON public.back_in_stock_subscriptions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_bis_variant_sku
  ON public.back_in_stock_subscriptions (variant_sku) WHERE variant_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bis_customer_phone
  ON public.back_in_stock_subscriptions (customer_phone);

-- Avoid duplicate pending subscriptions for the same customer + product variant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bis_pending_phone_variant
  ON public.back_in_stock_subscriptions (
    organization_id, customer_phone, coalesce(variant_sku, product_name || '|' || coalesce(size,'') || '|' || coalesce(color,''))
  )
  WHERE status = 'pending';

-- Edge Functions use the service role (bypasses RLS). Enable RLS so the table is
-- not exposed to anon/authenticated clients by default.
ALTER TABLE public.back_in_stock_subscriptions ENABLE ROW LEVEL SECURITY;
