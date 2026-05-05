-- Table to track express delivery notifications sent via WhatsApp
CREATE TABLE IF NOT EXISTS public.express_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT NOT NULL,
  conversation_id UUID REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  delivery_code TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  notification_message_id UUID REFERENCES public.messaging_messages(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shopify_order_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_express_notifications_org ON public.express_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_express_notifications_status ON public.express_notifications(status);

-- RLS
ALTER TABLE public.express_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view express notifications for their organization"
  ON public.express_notifications FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert express notifications for their organization"
  ON public.express_notifications FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to express_notifications"
  ON public.express_notifications FOR ALL
  USING (auth.role() = 'service_role');
