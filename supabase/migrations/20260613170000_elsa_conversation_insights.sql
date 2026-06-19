-- Elsa conversation insights: anonymized business/product/support signals from chats.
-- This is intentionally separate from elsa_response_learnings, which teaches Elsa how to answer.
-- Insights capture what Dosmicos should learn: product demand, friction, quality notes,
-- positive signals, and answer/process improvements.

CREATE TABLE IF NOT EXISTS public.elsa_conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN (
    'product_request',
    'catalog_gap',
    'answer_improvement',
    'quality_feedback',
    'customer_objection',
    'operations_friction',
    'positive_signal',
    'general'
  )),
  sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK (sentiment IN (
    'opportunity',
    'improvement',
    'positive',
    'risk',
    'neutral'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'archived', 'done')),
  summary TEXT NOT NULL,
  evidence TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual_note' CHECK (source IN (
    'customer_message',
    'human_feedback',
    'human_reply',
    'elsa_review',
    'manual_note'
  )),
  source_conversation_ids UUID[] NOT NULL DEFAULT '{}',
  source_message_ids UUID[] NOT NULL DEFAULT '{}',
  owner TEXT,
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_elsa_conversation_insights_org_status_priority
  ON public.elsa_conversation_insights(organization_id, status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_elsa_conversation_insights_type
  ON public.elsa_conversation_insights(type);

CREATE INDEX IF NOT EXISTS idx_elsa_conversation_insights_tags
  ON public.elsa_conversation_insights USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_elsa_conversation_insights_metadata
  ON public.elsa_conversation_insights USING GIN(metadata);

ALTER TABLE public.elsa_conversation_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view Elsa conversation insights for their organization"
  ON public.elsa_conversation_insights;
CREATE POLICY "Users can view Elsa conversation insights for their organization"
  ON public.elsa_conversation_insights
  FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations()));

-- Service role bypasses RLS for writes from Edge Functions and agent jobs.
