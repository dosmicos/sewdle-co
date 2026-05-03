-- Elsa-Hermes support agent persistence
-- Sewdle remains the inbox/system of record; these tables store agent run logs
-- and compact human-derived learnings for Elsa.

CREATE TABLE IF NOT EXISTS public.elsa_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.messaging_conversations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'hermes',
  confidence NUMERIC,
  handoff_required BOOLEAN NOT NULL DEFAULT false,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_preview TEXT,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elsa_agent_runs_org_created
  ON public.elsa_agent_runs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_elsa_agent_runs_conversation_created
  ON public.elsa_agent_runs(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.elsa_response_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  situation TEXT NOT NULL,
  recommended_response TEXT NOT NULL,
  avoid_response TEXT,
  source_conversation_ids UUID[] NOT NULL DEFAULT '{}',
  source_message_ids UUID[] NOT NULL DEFAULT '{}',
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'needs_review')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elsa_response_learnings_org_status_confidence
  ON public.elsa_response_learnings(organization_id, status, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_elsa_response_learnings_category
  ON public.elsa_response_learnings(category);

ALTER TABLE public.elsa_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elsa_response_learnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view Elsa agent runs for their organization" ON public.elsa_agent_runs;
CREATE POLICY "Users can view Elsa agent runs for their organization"
  ON public.elsa_agent_runs
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

DROP POLICY IF EXISTS "Users can view Elsa learnings for their organization" ON public.elsa_response_learnings;
CREATE POLICY "Users can view Elsa learnings for their organization"
  ON public.elsa_response_learnings
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

-- Service role bypasses RLS for inserts/updates from Edge Functions and local learning scripts.
