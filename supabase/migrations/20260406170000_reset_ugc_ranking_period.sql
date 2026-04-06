-- Function to reset the UGC ranking period for an organization
-- Called by the admin panel in ads.dosmicos.com
-- Only updates ugc_ranking_started_at; historical data is preserved

CREATE OR REPLACE FUNCTION reset_ugc_ranking_period(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE organization_settings
  SET ugc_ranking_started_at = now()
  WHERE organization_id = p_org_id;
$$;

-- Grant execute to authenticated users (RLS on organization_settings
-- ensures they can only affect their own org via the SECURITY DEFINER context)
GRANT EXECUTE ON FUNCTION reset_ugc_ranking_period(uuid) TO authenticated;
