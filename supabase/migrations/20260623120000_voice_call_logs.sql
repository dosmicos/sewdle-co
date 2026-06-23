-- Voice call logs for outbound order-confirmation calls (ElevenLabs Conversational AI).
-- One row per call attempt to confirm a COD order that was not confirmed via WhatsApp.
CREATE TABLE IF NOT EXISTS public.voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_order_id BIGINT,
  order_confirmation_id UUID REFERENCES public.order_confirmations(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  customer_phone TEXT,
  customer_name TEXT,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  provider_call_id TEXT,                 -- ElevenLabs conversation/call id
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','ringing','in_progress','completed','no_answer','busy','failed','cancelled')),
  outcome TEXT CHECK (outcome IN ('confirmed','rejected','reschedule','no_answer','unclear')),
  reschedule_at TIMESTAMPTZ,
  transcript JSONB,
  transcript_summary TEXT,
  duration_seconds INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voice_call_logs_org_status ON public.voice_call_logs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_voice_call_logs_order ON public.voice_call_logs(shopify_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voice_call_logs_provider_call
  ON public.voice_call_logs(provider_call_id) WHERE provider_call_id IS NOT NULL;

ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;

-- Read for org members (mirrors order_confirmations policies).
CREATE POLICY "Users can view voice call logs for their organization"
  ON public.voice_call_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  );

-- Edge functions write via service role.
CREATE POLICY "Service role full access to voice_call_logs"
  ON public.voice_call_logs FOR ALL
  USING (auth.role() = 'service_role');
