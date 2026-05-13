-- Internal Club de Mamás sale alerts for Sebastián.
-- Sends/logs a private WhatsApp alert whenever a UGC attributed order is generated.
-- No customer PII is stored here; the group message suggestion only includes creator name.

CREATE TABLE IF NOT EXISTS public.ugc_internal_sale_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  attributed_order_id uuid NOT NULL REFERENCES public.ugc_attributed_orders(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  shopify_order_id text,
  shopify_order_number text,
  whatsapp_number text NOT NULL,
  conversation_id uuid REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  messaging_message_id uuid REFERENCES public.messaging_messages(id) ON DELETE SET NULL,
  external_message_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped_duplicate')),
  message_preview text NOT NULL,
  group_post_suggestion text NOT NULL,
  error jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attributed_order_id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_internal_sale_alerts_org_created
  ON public.ugc_internal_sale_alerts(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ugc_internal_sale_alerts_status
  ON public.ugc_internal_sale_alerts(status);

ALTER TABLE public.ugc_internal_sale_alerts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ugc_internal_sale_alerts'
      AND policyname = 'ugc_internal_sale_alerts_org_access'
  ) THEN
    CREATE POLICY "ugc_internal_sale_alerts_org_access"
      ON public.ugc_internal_sale_alerts
      FOR ALL
      USING (organization_id = get_current_organization_safe())
      WITH CHECK (organization_id = get_current_organization_safe());
  END IF;
END $$;
