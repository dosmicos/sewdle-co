-- Fix Club UGC portal functions under SECURITY DEFINER search_path.
-- Supabase installs pgcrypto helpers in the extensions schema, while these
-- functions intentionally lock search_path to public for safety.

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

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.ugc_creator_portal_links (
    organization_id,
    creator_id,
    token_hash,
    token_last4,
    created_by
  ) VALUES (
    v_org,
    p_creator_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    auth.uid()
  );

  RETURN QUERY SELECT
    v_token,
    ('https://club.dosmicos.com/c/' || v_token)::text,
    right(v_token, 4)::text;
END;
$$;

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

  v_token_hash := encode(extensions.digest(trim(p_token), 'sha256'), 'hex');

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

GRANT EXECUTE ON FUNCTION public.generate_ugc_creator_portal_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ugc_creator_portal_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_ugc_creator_portal_by_token(text) TO authenticated;
