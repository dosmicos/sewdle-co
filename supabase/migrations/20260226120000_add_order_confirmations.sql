-- Table to track COD order confirmation requests via WhatsApp
CREATE TABLE IF NOT EXISTS public.order_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT NOT NULL,
  conversation_id UUID REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'needs_attention', 'expired', 'cancelled')),
  confirmation_message_id UUID REFERENCES public.messaging_messages(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shopify_order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_confirmations_org ON public.order_confirmations(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_status ON public.order_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_conversation ON public.order_confirmations(conversation_id);

-- RLS
ALTER TABLE public.order_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view order confirmations for their organization"
  ON public.order_confirmations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order confirmations for their organization"
  ON public.order_confirmations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update order confirmations for their organization"
  ON public.order_confirmations FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to order_confirmations"
  ON public.order_confirmations FOR ALL
  USING (auth.role() = 'service_role');

-- System tags for Dosmicos org (idempotent)
INSERT INTO public.messaging_conversation_tags (organization_id, name, color)
VALUES
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'Confirmacion pendiente', '#f59e0b'),
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'Requiere atencion', '#f43f5e')
ON CONFLICT (organization_id, name) DO NOTHING;
