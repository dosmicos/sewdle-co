
-- Tags for UGC creators
CREATE TABLE public.ugc_creator_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#9ca3af',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.ugc_creator_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ugc_creator_tags in their org"
  ON public.ugc_creator_tags FOR SELECT
  USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can insert ugc_creator_tags in their org"
  ON public.ugc_creator_tags FOR INSERT
  WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Users can update ugc_creator_tags in their org"
  ON public.ugc_creator_tags FOR UPDATE
  USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can delete ugc_creator_tags in their org"
  ON public.ugc_creator_tags FOR DELETE
  USING (organization_id = get_current_organization_safe());

-- Tag assignments (many-to-many)
CREATE TABLE public.ugc_creator_tag_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.ugc_creator_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, tag_id)
);

ALTER TABLE public.ugc_creator_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ugc_creator_tag_assignments via creator org"
  ON public.ugc_creator_tag_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.ugc_creators c 
    WHERE c.id = creator_id AND c.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Users can insert ugc_creator_tag_assignments via creator org"
  ON public.ugc_creator_tag_assignments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ugc_creators c 
    WHERE c.id = creator_id AND c.organization_id = get_current_organization_safe()
  ));

CREATE POLICY "Users can delete ugc_creator_tag_assignments via creator org"
  ON public.ugc_creator_tag_assignments FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.ugc_creators c 
    WHERE c.id = creator_id AND c.organization_id = get_current_organization_safe()
  ));
