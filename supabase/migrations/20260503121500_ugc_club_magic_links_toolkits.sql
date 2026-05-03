-- Club Dosmicos UGC creator portal
-- Magic links, campaign/extra toolkit assignments, and default upload token lifecycle.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Creator portal magic links ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ugc_creator_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  token_last4 text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  last_accessed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ugc_creator_portal_links_creator
  ON public.ugc_creator_portal_links(creator_id);

CREATE INDEX IF NOT EXISTS idx_ugc_creator_portal_links_org
  ON public.ugc_creator_portal_links(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ugc_creator_portal_links_one_active_per_creator
  ON public.ugc_creator_portal_links(creator_id)
  WHERE is_active = true;

ALTER TABLE public.ugc_creator_portal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ugc_creator_portal_links_org_access" ON public.ugc_creator_portal_links;
CREATE POLICY "ugc_creator_portal_links_org_access"
ON public.ugc_creator_portal_links
FOR ALL
USING (organization_id = get_current_organization_safe())
WITH CHECK (organization_id = get_current_organization_safe());

-- ─── Toolkit assignments ──────────────────────────────────────────
-- Campaign-level by default; campaign_id NULL allows extra toolkits without creating a campaign.

CREATE TABLE IF NOT EXISTS public.ugc_toolkit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.ugc_creators(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES public.ugc_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Idea de contenido',
  toolkit_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ugc_toolkit_assignments_url_https CHECK (toolkit_url ~* '^https://')
);

CREATE INDEX IF NOT EXISTS idx_ugc_toolkit_assignments_creator
  ON public.ugc_toolkit_assignments(creator_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ugc_toolkit_assignments_campaign
  ON public.ugc_toolkit_assignments(campaign_id);

CREATE INDEX IF NOT EXISTS idx_ugc_toolkit_assignments_org
  ON public.ugc_toolkit_assignments(organization_id);

ALTER TABLE public.ugc_toolkit_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ugc_toolkit_assignments_org_access" ON public.ugc_toolkit_assignments;
CREATE POLICY "ugc_toolkit_assignments_org_access"
ON public.ugc_toolkit_assignments
FOR ALL
USING (organization_id = get_current_organization_safe())
WITH CHECK (organization_id = get_current_organization_safe());

-- ─── Updated_at helper ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_ugc_club_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ugc_creator_portal_links_updated_at ON public.ugc_creator_portal_links;
CREATE TRIGGER trg_ugc_creator_portal_links_updated_at
BEFORE UPDATE ON public.ugc_creator_portal_links
FOR EACH ROW
EXECUTE FUNCTION public.update_ugc_club_updated_at();

DROP TRIGGER IF EXISTS trg_ugc_toolkit_assignments_updated_at ON public.ugc_toolkit_assignments;
CREATE TRIGGER trg_ugc_toolkit_assignments_updated_at
BEFORE UPDATE ON public.ugc_toolkit_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_ugc_club_updated_at();

-- ─── Default upload token lifecycle ───────────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_ugc_upload_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ugc_upload_tokens (
    organization_id,
    creator_id,
    is_active,
    expires_at,
    max_uploads
  )
  SELECT
    NEW.organization_id,
    NEW.id,
    true,
    NULL,
    NULL
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.ugc_upload_tokens ut
    WHERE ut.creator_id = NEW.id
      AND ut.is_active = true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_default_ugc_upload_token ON public.ugc_creators;
CREATE TRIGGER trg_create_default_ugc_upload_token
AFTER INSERT ON public.ugc_creators
FOR EACH ROW
EXECUTE FUNCTION public.create_default_ugc_upload_token();

-- Backfill existing creators that do not have an active upload token.
INSERT INTO public.ugc_upload_tokens (
  organization_id,
  creator_id,
  is_active,
  expires_at,
  max_uploads
)
SELECT
  c.organization_id,
  c.id,
  true,
  NULL,
  NULL
FROM public.ugc_creators c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ugc_upload_tokens ut
  WHERE ut.creator_id = c.id
    AND ut.is_active = true
);

-- ─── Admin RPCs for Club portal links ─────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_ugc_creator_portal_link(p_creator_id uuid)
RETURNS TABLE(token text, portal_url text, token_last4 text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_token text;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.ugc_creators
  WHERE id = p_creator_id
    AND organization_id = get_current_organization_safe();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Creator not found or not in current organization';
  END IF;

  UPDATE public.ugc_creator_portal_links
  SET is_active = false,
      revoked_at = now(),
      updated_at = now()
  WHERE creator_id = p_creator_id
    AND is_active = true;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.ugc_creator_portal_links (
    organization_id,
    creator_id,
    token_hash,
    token_last4,
    created_by
  ) VALUES (
    v_org,
    p_creator_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    auth.uid()
  );

  RETURN QUERY SELECT
    v_token,
    ('https://club.dosmicos.com/c/' || v_token)::text,
    right(v_token, 4)::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_ugc_creator_portal_link(p_creator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.ugc_creators
  WHERE id = p_creator_id
    AND organization_id = get_current_organization_safe();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Creator not found or not in current organization';
  END IF;

  UPDATE public.ugc_creator_portal_links
  SET is_active = false,
      revoked_at = now(),
      updated_at = now()
  WHERE creator_id = p_creator_id
    AND is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_ugc_creator_portal_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_ugc_creator_portal_link(uuid) TO authenticated;

-- ─── Public RPC for creator portal ────────────────────────────────
-- Safe payload only: no customer PII, no raw Shopify discount code.

CREATE OR REPLACE FUNCTION public.get_ugc_creator_portal_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_portal public.ugc_creator_portal_links%ROWTYPE;
  v_creator public.ugc_creators%ROWTYPE;
  v_discount jsonb;
  v_upload jsonb;
  v_toolkits jsonb;
  v_recent_orders jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 24 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  v_token_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO v_portal
  FROM public.ugc_creator_portal_links
  WHERE token_hash = v_token_hash
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_creator
  FROM public.ugc_creators
  WHERE id = v_portal.creator_id
    AND organization_id = v_portal.organization_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'creator_not_found');
  END IF;

  UPDATE public.ugc_creator_portal_links
  SET last_accessed_at = now(), updated_at = now()
  WHERE id = v_portal.id;

  SELECT jsonb_build_object(
    'id', dl.id,
    'public_url', 'https://ads.dosmicos.com/ugc/' || dl.redirect_token,
    'discount_value', dl.discount_value,
    'commission_rate', dl.commission_rate,
    'total_orders', dl.total_orders,
    'total_revenue', dl.total_revenue,
    'total_commission', dl.total_commission,
    'total_paid_out', COALESCE(dl.total_paid_out, 0),
    'pending_balance', GREATEST(COALESCE(dl.total_commission, 0) - COALESCE(dl.total_paid_out, 0), 0)
  ) INTO v_discount
  FROM public.ugc_discount_links dl
  WHERE dl.creator_id = v_creator.id
    AND dl.organization_id = v_creator.organization_id
    AND dl.is_active = true
  ORDER BY dl.created_at DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'upload_url', CASE WHEN ut.token IS NULL THEN NULL ELSE 'https://club.dosmicos.com/upload/' || ut.token END,
    'is_active', COALESCE(ut.is_active, false),
    'expires_at', ut.expires_at,
    'upload_count', COALESCE(ut.upload_count, 0),
    'max_uploads', ut.max_uploads
  ) INTO v_upload
  FROM public.ugc_upload_tokens ut
  WHERE ut.creator_id = v_creator.id
    AND ut.organization_id = v_creator.organization_id
    AND ut.is_active = true
    AND (ut.expires_at IS NULL OR ut.expires_at > now())
  ORDER BY ut.created_at DESC
  LIMIT 1;

  IF v_upload IS NULL THEN
    v_upload := jsonb_build_object('upload_url', NULL, 'is_active', false);
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'label', COALESCE(NULLIF(t.label, ''), 'Idea de contenido'),
      'url', t.toolkit_url,
      'campaign_id', t.campaign_id,
      'sort_order', t.sort_order
    ) ORDER BY t.sort_order ASC, t.created_at DESC
  ), '[]'::jsonb) INTO v_toolkits
  FROM public.ugc_toolkit_assignments t
  WHERE t.creator_id = v_creator.id
    AND t.organization_id = v_creator.organization_id
    AND t.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'shopify_order_number', ao.shopify_order_number,
      'order_total', ao.order_total,
      'commission_amount', ao.commission_amount,
      'order_date', ao.order_date
    ) ORDER BY ao.order_date DESC
  ), '[]'::jsonb) INTO v_recent_orders
  FROM (
    SELECT ao.shopify_order_number, ao.order_total, ao.commission_amount, ao.order_date
    FROM public.ugc_attributed_orders ao
    WHERE ao.creator_id = v_creator.id
      AND ao.organization_id = v_creator.organization_id
    ORDER BY ao.order_date DESC
    LIMIT 10
  ) ao;

  RETURN jsonb_build_object(
    'valid', true,
    'creator', jsonb_build_object(
      'id', v_creator.id,
      'name', v_creator.name,
      'instagram_handle', v_creator.instagram_handle,
      'tiktok_handle', v_creator.tiktok_handle,
      'avatar_url', v_creator.avatar_url
    ),
    'discount_link', v_discount,
    'upload', v_upload,
    'toolkits', v_toolkits,
    'recent_orders', v_recent_orders
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ugc_creator_portal_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ugc_creator_portal_by_token(text) TO authenticated;
