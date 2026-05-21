CREATE OR REPLACE FUNCTION update_ugc_commission_rate(p_link_id uuid, p_rate numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE ugc_discount_links
  SET commission_rate = p_rate, updated_at = now()
  WHERE id = p_link_id;
$$;
REVOKE EXECUTE ON FUNCTION update_ugc_commission_rate(uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION update_ugc_commission_rate(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION update_ugc_commission_rate(uuid, numeric) TO service_role;
