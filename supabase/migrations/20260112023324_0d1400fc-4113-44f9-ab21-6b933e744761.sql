-- Create table for organization tags
CREATE TABLE public.messaging_conversation_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Create table for tag assignments to conversations
CREATE TABLE public.messaging_conversation_tag_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messaging_conversations(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.messaging_conversation_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE(conversation_id, tag_id)
);

-- Enable RLS
ALTER TABLE public.messaging_conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_conversation_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for messaging_conversation_tags
CREATE POLICY "Users can view tags from their organization"
ON public.messaging_conversation_tags
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tags in their organization"
ON public.messaging_conversation_tags
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tags in their organization"
ON public.messaging_conversation_tags
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete tags in their organization"
ON public.messaging_conversation_tags
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
  )
);

-- RLS Policies for messaging_conversation_tag_assignments
CREATE POLICY "Users can view tag assignments from their organization"
ON public.messaging_conversation_tag_assignments
FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM public.messaging_conversations 
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can assign tags in their organization"
ON public.messaging_conversation_tag_assignments
FOR INSERT
WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.messaging_conversations 
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can remove tag assignments in their organization"
ON public.messaging_conversation_tag_assignments
FOR DELETE
USING (
  conversation_id IN (
    SELECT id FROM public.messaging_conversations 
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_users WHERE user_id = auth.uid()
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_messaging_tags_org ON public.messaging_conversation_tags(organization_id);
CREATE INDEX idx_messaging_tag_assignments_conversation ON public.messaging_conversation_tag_assignments(conversation_id);
CREATE INDEX idx_messaging_tag_assignments_tag ON public.messaging_conversation_tag_assignments(tag_id);

-- Add updated_at trigger for tags
CREATE TRIGGER update_messaging_conversation_tags_updated_at
BEFORE UPDATE ON public.messaging_conversation_tags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();