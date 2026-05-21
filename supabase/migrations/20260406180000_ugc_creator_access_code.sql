-- Add access_code column to ugc_creators
-- This code is given to each UGC creator so they can see their own balance on ads.dosmicos.com

ALTER TABLE ugc_creators
  ADD COLUMN IF NOT EXISTS access_code text;

-- Auto-generate code for existing creators that don't have one
UPDATE ugc_creators
SET access_code = upper(substring(md5(random()::text) from 1 for 6))
WHERE access_code IS NULL;

-- Function to generate a 6-char alphanumeric access code
CREATE OR REPLACE FUNCTION generate_ugc_access_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.access_code IS NULL THEN
    NEW.access_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: auto-assign code on INSERT
DROP TRIGGER IF EXISTS ugc_creator_access_code_trigger ON ugc_creators;
CREATE TRIGGER ugc_creator_access_code_trigger
BEFORE INSERT ON ugc_creators
FOR EACH ROW EXECUTE FUNCTION generate_ugc_access_code();

-- Public RPC: look up a creator's balance by their access code
-- Returns only that creator's info — no auth required (SECURITY DEFINER + code acts as auth)
CREATE OR REPLACE FUNCTION get_creator_balance_by_code(p_code text)
RETURNS TABLE (
  creator_name text,
  instagram_handle text,
  avatar_url text,
  pending_balance numeric
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.name::text                                AS creator_name,
    c.instagram_handle::text                   AS instagram_handle,
    c.avatar_url::text                         AS avatar_url,
    GREATEST(
      COALESCE(l.total_commission, 0) - COALESCE(l.total_paid_out, 0),
      0
    )::numeric                                 AS pending_balance
  FROM ugc_creators c
  LEFT JOIN ugc_discount_links l
    ON l.creator_id = c.id AND l.is_active = true
  WHERE upper(c.access_code) = upper(p_code)
  LIMIT 1;
$$;
