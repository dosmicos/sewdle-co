-- Function to reset the UGC ranking period for an organization.
-- The public RPC get_ugc_public_ranking reads ugc_ranking_started_at from
-- organizations.settings (a JSONB column), so this function updates that same field.

CREATE OR REPLACE FUNCTION reset_ugc_ranking_period(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE organizations
  SET settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{ugc_ranking_started_at}',
    to_jsonb(now()::text)
  )
  WHERE id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION reset_ugc_ranking_period(uuid) TO authenticated;
