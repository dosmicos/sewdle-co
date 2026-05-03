-- Persist full Club portal URLs for admin reuse.
-- Julian requested that generated unique Club links stay visible/copyable
-- instead of forcing admins to regenerate them every time.

ALTER TABLE public.ugc_creator_portal_links
  ADD COLUMN IF NOT EXISTS portal_url text;

CREATE OR REPLACE FUNCTION public.generate_ugc_creator_portal_link(p_creator_id uuid)
RETURNS TABLE(token text, portal_url text, token_last4 text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_token text;
  v_portal_url text;
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
  v_portal_url := 'https://club.dosmicos.com/c/' || v_token;

  INSERT INTO public.ugc_creator_portal_links (
    organization_id,
    creator_id,
    token_hash,
    token_last4,
    portal_url,
    created_by
  ) VALUES (
    v_org,
    p_creator_id,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    right(v_token, 4),
    v_portal_url,
    auth.uid()
  );

  RETURN QUERY SELECT
    v_token,
    v_portal_url,
    right(v_token, 4)::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_ugc_creator_portal_link(uuid) TO authenticated;
