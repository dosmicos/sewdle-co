
CREATE TABLE public.ugc_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.ugc_campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('producto_entregado', 'contactar_creador')),
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ugc_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage notifications in their org"
  ON public.ugc_notifications FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_users
    WHERE user_id = auth.uid()
  ));

CREATE INDEX idx_ugc_notifications_org_read ON public.ugc_notifications(organization_id, read);
CREATE INDEX idx_ugc_notifications_campaign ON public.ugc_notifications(campaign_id);
