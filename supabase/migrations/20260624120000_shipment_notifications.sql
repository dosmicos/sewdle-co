-- Notificaciones de estado de envío enviadas al cliente por WhatsApp.
-- Alimentada por la edge function `envia-tracking-webhook` (push de Envia.com).
-- Sirve de log + dedupe: una notificación por (guía, etapa).
-- Etapas que notifican: recolectado, en_reparto, incidencia (decisión de producto).
CREATE TABLE IF NOT EXISTS public.shipment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shipping_label_id UUID NOT NULL REFERENCES public.shipping_labels(id) ON DELETE CASCADE,
  tracking_number TEXT,
  shopify_order_id BIGINT,
  order_number TEXT,
  carrier TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('recolectado', 'en_reparto', 'incidencia')),
  customer_phone TEXT,
  conversation_id UUID REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  external_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'skipped_no_phone', 'skipped_no_template')),
  raw JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotencia: una notificación por guía+etapa (el webhook puede llegar repetido).
  UNIQUE (shipping_label_id, stage)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_shipment_notifications_org ON public.shipment_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_shipment_notifications_label ON public.shipment_notifications(shipping_label_id);
CREATE INDEX IF NOT EXISTS idx_shipment_notifications_tracking ON public.shipment_notifications(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipment_notifications_status ON public.shipment_notifications(status);

-- RLS (mismo patrón que express_notifications)
ALTER TABLE public.shipment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipment notifications for their organization"
  ON public.shipment_notifications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to shipment_notifications"
  ON public.shipment_notifications FOR ALL
  USING (auth.role() = 'service_role');
