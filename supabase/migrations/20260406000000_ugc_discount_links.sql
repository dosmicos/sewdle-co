-- UGC Discount Links & Attribution
-- Creators get an opaque redirect link; Shopify discount code is never exposed in UI

CREATE TABLE IF NOT EXISTS ugc_discount_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  redirect_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(8), 'hex'),
  shopify_price_rule_id text,
  shopify_discount_code text NOT NULL,
  discount_value numeric NOT NULL DEFAULT 10,
  commission_rate numeric NOT NULL DEFAULT 10,
  total_orders integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_commission numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ugc_attributed_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  discount_link_id uuid NOT NULL REFERENCES ugc_discount_links(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  shopify_order_id text UNIQUE NOT NULL,
  shopify_order_number text,
  order_total numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  order_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ugc_discount_links_org ON ugc_discount_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_ugc_discount_links_creator ON ugc_discount_links(creator_id);
CREATE INDEX IF NOT EXISTS idx_ugc_discount_links_token ON ugc_discount_links(redirect_token);
CREATE INDEX IF NOT EXISTS idx_ugc_attributed_orders_link ON ugc_attributed_orders(discount_link_id);
CREATE INDEX IF NOT EXISTS idx_ugc_attributed_orders_creator ON ugc_attributed_orders(creator_id);
CREATE INDEX IF NOT EXISTS idx_ugc_attributed_orders_date ON ugc_attributed_orders(order_date);

-- RLS
ALTER TABLE ugc_discount_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE ugc_attributed_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_discount_links_org_access" ON ugc_discount_links
  FOR ALL USING (organization_id = get_current_organization_safe());

CREATE POLICY "ugc_attributed_orders_org_access" ON ugc_attributed_orders
  FOR ALL USING (organization_id = get_current_organization_safe());

-- Public RPC for the ranking page (no auth required, SECURITY DEFINER)
-- Uses organizations.settings->>'ugc_ranking_started_at' to filter current period
CREATE OR REPLACE FUNCTION get_ugc_public_ranking(p_org_slug text)
RETURNS TABLE(
  creator_name text,
  instagram_handle text,
  avatar_url text,
  orders_in_period bigint,
  commission_in_period numeric,
  rank bigint
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
    c.name::text AS creator_name,
    COALESCE(c.instagram_handle, '')::text AS instagram_handle,
    COALESCE(c.avatar_url, '')::text AS avatar_url,
    COUNT(ao.id) AS orders_in_period,
    COALESCE(SUM(ao.commission_amount), 0) AS commission_in_period,
    RANK() OVER (ORDER BY COALESCE(SUM(ao.commission_amount), 0) DESC) AS rank
  FROM ugc_discount_links dl
  JOIN ugc_creators c ON c.id = dl.creator_id
  JOIN org ON org.id = dl.organization_id
  LEFT JOIN ugc_attributed_orders ao
    ON ao.discount_link_id = dl.id
    AND ao.order_date >= (SELECT started_at FROM ranking_start)
  WHERE dl.organization_id = (SELECT id FROM org)
    AND dl.is_active = true
  GROUP BY c.id, c.name, c.instagram_handle, c.avatar_url
  ORDER BY commission_in_period DESC;
$$;

-- Allow public (anon) to call this function
GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO anon;
GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO authenticated;

-- Atomic increment function for webhook handler (avoids read-modify-write race condition)
CREATE OR REPLACE FUNCTION increment_ugc_link_totals(
  p_link_id uuid,
  p_revenue numeric,
  p_commission numeric
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE ugc_discount_links
  SET
    total_orders = total_orders + 1,
    total_revenue = total_revenue + p_revenue,
    total_commission = total_commission + p_commission,
    updated_at = now()
  WHERE id = p_link_id;
$$;

-- Updated_at trigger for ugc_discount_links
CREATE OR REPLACE FUNCTION update_ugc_discount_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ugc_discount_links_updated_at
  BEFORE UPDATE ON ugc_discount_links
  FOR EACH ROW EXECUTE FUNCTION update_ugc_discount_links_updated_at();
