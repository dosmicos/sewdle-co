-- Commission payouts: tracks when admin registers a payment to a creator
-- Balance = total_commission - total_paid_out

ALTER TABLE ugc_discount_links
  ADD COLUMN IF NOT EXISTS total_paid_out numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ugc_commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  discount_link_id uuid NOT NULL REFERENCES ugc_discount_links(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payout_type text NOT NULL DEFAULT 'nequi', -- 'nequi' | 'discount' | 'other'
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ugc_commission_payouts_link    ON ugc_commission_payouts(discount_link_id);
CREATE INDEX IF NOT EXISTS idx_ugc_commission_payouts_creator ON ugc_commission_payouts(creator_id);

ALTER TABLE ugc_commission_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_commission_payouts_org_access" ON ugc_commission_payouts
  FOR ALL USING (organization_id = get_current_organization_safe());

-- Atomic decrement for paid_out (called when admin registers a payout)
CREATE OR REPLACE FUNCTION register_ugc_commission_payout(
  p_link_id    uuid,
  p_amount     numeric,
  p_type       text,
  p_notes      text,
  p_creator_id uuid,
  p_org_id     uuid
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_payout_id uuid;
BEGIN
  INSERT INTO ugc_commission_payouts(
    organization_id, discount_link_id, creator_id, amount, payout_type, notes, created_by
  )
  VALUES (p_org_id, p_link_id, p_creator_id, p_amount, p_type, p_notes, auth.uid())
  RETURNING id INTO v_payout_id;

  UPDATE ugc_discount_links
  SET total_paid_out = total_paid_out + p_amount,
      updated_at     = now()
  WHERE id = p_link_id;

  RETURN v_payout_id;
END;
$$;

GRANT EXECUTE ON FUNCTION register_ugc_commission_payout(uuid, numeric, text, text, uuid, uuid) TO authenticated;

-- Update public ranking RPC to include pending_balance
CREATE OR REPLACE FUNCTION get_ugc_public_ranking(p_org_slug text)
RETURNS TABLE(
  creator_name        text,
  instagram_handle    text,
  avatar_url          text,
  orders_in_period    bigint,
  commission_in_period numeric,
  pending_balance     numeric,
  rank                bigint
)
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  WITH ranking_start AS (
    SELECT COALESCE(
      (settings->>'ugc_ranking_started_at')::timestamptz,
      '2020-01-01'::timestamptz
    ) AS started_at
    FROM organizations
    WHERE slug = p_org_slug
    LIMIT 1
  ),
  org AS (
    SELECT id FROM organizations WHERE slug = p_org_slug LIMIT 1
  )
  SELECT
    c.name::text                                        AS creator_name,
    COALESCE(c.instagram_handle, '')::text              AS instagram_handle,
    COALESCE(c.avatar_url, '')::text                    AS avatar_url,
    COUNT(ao.id)                                        AS orders_in_period,
    COALESCE(SUM(ao.commission_amount), 0)              AS commission_in_period,
    GREATEST(dl.total_commission - dl.total_paid_out, 0) AS pending_balance,
    RANK() OVER (ORDER BY COALESCE(SUM(ao.commission_amount), 0) DESC) AS rank
  FROM ugc_discount_links dl
  JOIN ugc_creators c ON c.id = dl.creator_id
  JOIN org           ON org.id = dl.organization_id
  LEFT JOIN ugc_attributed_orders ao
         ON ao.discount_link_id = dl.id
        AND ao.order_date >= (SELECT started_at FROM ranking_start)
  WHERE dl.organization_id = (SELECT id FROM org)
    AND dl.is_active = true
  GROUP BY c.id, c.name, c.instagram_handle, c.avatar_url,
           dl.total_commission, dl.total_paid_out
  ORDER BY commission_in_period DESC;
$$;

GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO anon;
GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO authenticated;
