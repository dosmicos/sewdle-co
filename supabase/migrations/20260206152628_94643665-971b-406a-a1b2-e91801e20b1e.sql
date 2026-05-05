
-- =============================================
-- UGC Creators CRM Module
-- =============================================

-- 1. Create ugc_creators table
CREATE TABLE public.ugc_creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instagram_handle TEXT,
  instagram_followers INTEGER DEFAULT 0,
  email TEXT,
  phone TEXT,
  city TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'prospecto' CHECK (status IN ('prospecto', 'contactado', 'negociando', 'activo', 'inactivo')),
  engagement_rate DECIMAL(5,2),
  avg_likes INTEGER DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create ugc_creator_children table
CREATE TABLE public.ugc_creator_children (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date DATE,
  size TEXT,
  gender TEXT CHECK (gender IS NULL OR gender IN ('masculino', 'femenino', 'otro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create ugc_campaigns table
CREATE TABLE public.ugc_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'contactado' CHECK (status IN (
    'contactado', 'negociando', 'aceptado', 'producto_enviado', 
    'producto_recibido', 'video_en_revision', 'video_aprobado', 
    'publicado', 'completado', 'cancelado'
  )),
  product_sent TEXT,
  tracking_number TEXT,
  shipping_date DATE,
  received_date DATE,
  deadline DATE,
  agreed_videos INTEGER DEFAULT 1,
  agreed_payment DECIMAL(10,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'producto' CHECK (payment_type IN ('producto', 'efectivo', 'mixto')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create ugc_videos table
CREATE TABLE public.ugc_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ugc_campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_revision', 'aprobado', 'rechazado', 'publicado')),
  likes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  platform TEXT CHECK (platform IS NULL OR platform IN ('instagram_reel', 'instagram_story', 'tiktok')),
  published_date DATE,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create indexes
CREATE INDEX idx_ugc_creators_org ON public.ugc_creators(organization_id);
CREATE INDEX idx_ugc_creators_status ON public.ugc_creators(status);
CREATE INDEX idx_ugc_creators_instagram ON public.ugc_creators(instagram_handle);
CREATE INDEX idx_ugc_children_creator ON public.ugc_creator_children(creator_id);
CREATE INDEX idx_ugc_campaigns_creator ON public.ugc_campaigns(creator_id);
CREATE INDEX idx_ugc_campaigns_org ON public.ugc_campaigns(organization_id);
CREATE INDEX idx_ugc_campaigns_status ON public.ugc_campaigns(status);
CREATE INDEX idx_ugc_videos_campaign ON public.ugc_videos(campaign_id);
CREATE INDEX idx_ugc_videos_creator ON public.ugc_videos(creator_id);
CREATE INDEX idx_ugc_videos_org ON public.ugc_videos(organization_id);

-- 6. Enable RLS
ALTER TABLE public.ugc_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_creator_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ugc_videos ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for ugc_creators
CREATE POLICY "ugc_creators_select" ON public.ugc_creators
  FOR SELECT USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'view'))
  );

CREATE POLICY "ugc_creators_insert" ON public.ugc_creators
  FOR INSERT WITH CHECK (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'create'))
  );

CREATE POLICY "ugc_creators_update" ON public.ugc_creators
  FOR UPDATE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'edit'))
  );

CREATE POLICY "ugc_creators_delete" ON public.ugc_creators
  FOR DELETE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'delete'))
  );

-- 8. RLS Policies for ugc_creator_children
CREATE POLICY "ugc_children_select" ON public.ugc_creator_children
  FOR SELECT USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'view'))
  );

CREATE POLICY "ugc_children_insert" ON public.ugc_creator_children
  FOR INSERT WITH CHECK (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'create'))
  );

CREATE POLICY "ugc_children_update" ON public.ugc_creator_children
  FOR UPDATE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'edit'))
  );

CREATE POLICY "ugc_children_delete" ON public.ugc_creator_children
  FOR DELETE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'delete'))
  );

-- 9. RLS Policies for ugc_campaigns
CREATE POLICY "ugc_campaigns_select" ON public.ugc_campaigns
  FOR SELECT USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'view'))
  );

CREATE POLICY "ugc_campaigns_insert" ON public.ugc_campaigns
  FOR INSERT WITH CHECK (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'create'))
  );

CREATE POLICY "ugc_campaigns_update" ON public.ugc_campaigns
  FOR UPDATE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'edit'))
  );

CREATE POLICY "ugc_campaigns_delete" ON public.ugc_campaigns
  FOR DELETE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'delete'))
  );

-- 10. RLS Policies for ugc_videos
CREATE POLICY "ugc_videos_select" ON public.ugc_videos
  FOR SELECT USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'view'))
  );

CREATE POLICY "ugc_videos_insert" ON public.ugc_videos
  FOR INSERT WITH CHECK (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'create'))
  );

CREATE POLICY "ugc_videos_update" ON public.ugc_videos
  FOR UPDATE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'edit'))
  );

CREATE POLICY "ugc_videos_delete" ON public.ugc_videos
  FOR DELETE USING (
    organization_id = get_current_organization_safe()
    AND (is_current_user_admin() OR has_permission(auth.uid(), 'ugc', 'delete'))
  );

-- 11. Triggers for updated_at
CREATE TRIGGER update_ugc_creators_updated_at
  BEFORE UPDATE ON public.ugc_creators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ugc_children_updated_at
  BEFORE UPDATE ON public.ugc_creator_children
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ugc_campaigns_updated_at
  BEFORE UPDATE ON public.ugc_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ugc_videos_updated_at
  BEFORE UPDATE ON public.ugc_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Add 'ugc' module permissions to Administrador and Atención al Cliente roles
UPDATE public.roles
SET permissions = permissions || '{"ugc": {"view": true, "create": true, "edit": true, "delete": true}}'::jsonb
WHERE name IN ('Administrador', 'Atención al Cliente');
