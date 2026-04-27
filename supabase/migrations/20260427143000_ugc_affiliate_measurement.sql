-- UGC Affiliate Measurement System
-- Tracks link clicks, monthly goals, weekly report metrics, and fixes Dosmicos public ranking slug fallback.

-- ─── Link Click Tracking ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ugc_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  discount_link_id uuid NOT NULL REFERENCES ugc_discount_links(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES ugc_creators(id) ON DELETE CASCADE,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  landing_path text NOT NULL DEFAULT '/collections/all',
  ip_hash text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ugc_link_clicks_org_clicked_at
  ON ugc_link_clicks(organization_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_link_clicks_link_clicked_at
  ON ugc_link_clicks(discount_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_ugc_link_clicks_creator_clicked_at
  ON ugc_link_clicks(creator_id, clicked_at DESC);

ALTER TABLE ugc_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_link_clicks_org_select" ON ugc_link_clicks
  FOR SELECT USING (organization_id = get_current_organization_safe());

CREATE POLICY "ugc_link_clicks_org_insert" ON ugc_link_clicks
  FOR INSERT WITH CHECK (organization_id = get_current_organization_safe());

-- ─── Monthly Goals ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ugc_affiliate_monthly_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  revenue_goal numeric NOT NULL DEFAULT 6000000,
  stretch_revenue_goal numeric NOT NULL DEFAULT 10000000,
  orders_goal integer NOT NULL DEFAULT 25,
  converting_creators_goal integer NOT NULL DEFAULT 10,
  active_creators_goal integer NOT NULL DEFAULT 40,
  weekly_active_creators_goal integer NOT NULL DEFAULT 20,
  content_pieces_goal integer NOT NULL DEFAULT 120,
  active_links_goal integer NOT NULL DEFAULT 90,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, month_start)
);

CREATE INDEX IF NOT EXISTS idx_ugc_affiliate_monthly_goals_org_month
  ON ugc_affiliate_monthly_goals(organization_id, month_start DESC);

ALTER TABLE ugc_affiliate_monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ugc_affiliate_monthly_goals_org_access" ON ugc_affiliate_monthly_goals
  FOR ALL USING (organization_id = get_current_organization_safe())
  WITH CHECK (organization_id = get_current_organization_safe());

CREATE OR REPLACE FUNCTION update_ugc_affiliate_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ugc_affiliate_goals_updated_at ON ugc_affiliate_monthly_goals;
CREATE TRIGGER ugc_affiliate_goals_updated_at
  BEFORE UPDATE ON ugc_affiliate_monthly_goals
  FOR EACH ROW EXECUTE FUNCTION update_ugc_affiliate_goals_updated_at();

-- Seed Dosmicos May goals when the org exists.
INSERT INTO ugc_affiliate_monthly_goals (
  organization_id,
  month_start,
  revenue_goal,
  stretch_revenue_goal,
  orders_goal,
  converting_creators_goal,
  active_creators_goal,
  weekly_active_creators_goal,
  content_pieces_goal,
  active_links_goal,
  notes
)
SELECT
  id,
  DATE '2026-05-01',
  6000000,
  10000000,
  25,
  10,
  40,
  20,
  120,
  90,
  'Josh Show inspired CMD affiliate/UGC ramp target: turn links into weekly creator performance loop.'
FROM organizations
WHERE slug = 'dosmicos-org'
ON CONFLICT (organization_id, month_start) DO NOTHING;

-- ─── Public Ranking Slug Fallback ────────────────────────────────
-- Supports the historical public slug "dosmicos" while the live org slug is "dosmicos-org".

CREATE OR REPLACE FUNCTION get_ugc_public_ranking(p_org_slug text)
RETURNS TABLE(
  creator_name text,
  instagram_handle text,
  avatar_url text,
  orders_in_period bigint,
  commission_in_period numeric,
  pending_balance numeric,
  rank bigint
)
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  WITH org AS (
    SELECT id, settings
    FROM organizations
    WHERE slug = p_org_slug
       OR (p_org_slug = 'dosmicos' AND slug = 'dosmicos-org')
       OR lower(name) = lower(p_org_slug)
    ORDER BY CASE WHEN slug = p_org_slug THEN 0 ELSE 1 END
    LIMIT 1
  ),
  ranking_start AS (
    SELECT COALESCE(
      (settings->>'ugc_ranking_started_at')::timestamptz,
      '2020-01-01'::timestamptz
    ) AS started_at
    FROM org
  )
  SELECT
    c.name::text AS creator_name,
    COALESCE(c.instagram_handle, '')::text AS instagram_handle,
    COALESCE(c.avatar_url, '')::text AS avatar_url,
    COUNT(ao.id) AS orders_in_period,
    COALESCE(SUM(ao.commission_amount), 0) AS commission_in_period,
    GREATEST(dl.total_commission - COALESCE(dl.total_paid_out, 0), 0) AS pending_balance,
    RANK() OVER (ORDER BY COALESCE(SUM(ao.commission_amount), 0) DESC) AS rank
  FROM ugc_discount_links dl
  JOIN ugc_creators c ON c.id = dl.creator_id
  JOIN org ON org.id = dl.organization_id
  LEFT JOIN ugc_attributed_orders ao
    ON ao.discount_link_id = dl.id
    AND ao.order_date >= (SELECT started_at FROM ranking_start)
  WHERE dl.organization_id = (SELECT id FROM org)
    AND dl.is_active = true
  GROUP BY c.id, c.name, c.instagram_handle, c.avatar_url,
           dl.total_commission, dl.total_paid_out
  ORDER BY commission_in_period DESC, pending_balance DESC;
$$;

GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO anon;
GRANT EXECUTE ON FUNCTION get_ugc_public_ranking(text) TO authenticated;

-- ─── Weekly Affiliate Report RPC ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_ugc_affiliate_weekly_report(
  p_org_id uuid,
  p_week_start date DEFAULT NULL,
  p_tag_name text DEFAULT 'CMD',
  p_month_start date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_week_start date := COALESCE(
    p_week_start,
    (date_trunc('week', timezone('America/Bogota', now()))::date)
  );
  v_week_end date := COALESCE(
    p_week_start,
    (date_trunc('week', timezone('America/Bogota', now()))::date)
  ) + 7;
  v_month_start date := COALESCE(
    p_month_start,
    (date_trunc('month', timezone('America/Bogota', now()))::date)
  );
  v_month_end date := (COALESCE(
    p_month_start,
    (date_trunc('month', timezone('America/Bogota', now()))::date)
  ) + interval '1 month')::date;
  v_result jsonb;
BEGIN
  WITH cmd_tag AS (
    SELECT id
    FROM ugc_creator_tags
    WHERE organization_id = p_org_id
      AND lower(name) = lower(p_tag_name)
    LIMIT 1
  ),
  cohort AS (
    SELECT c.id, c.name, c.instagram_handle, c.status
    FROM ugc_creators c
    WHERE c.organization_id = p_org_id
      AND (
        NOT EXISTS (SELECT 1 FROM cmd_tag)
        OR EXISTS (
          SELECT 1
          FROM ugc_creator_tag_assignments a
          WHERE a.creator_id = c.id
            AND a.tag_id = (SELECT id FROM cmd_tag)
        )
      )
  ),
  active_links AS (
    SELECT dl.*
    FROM ugc_discount_links dl
    JOIN cohort c ON c.id = dl.creator_id
    WHERE dl.organization_id = p_org_id
      AND dl.is_active = true
  ),
  week_orders AS (
    SELECT ao.*
    FROM ugc_attributed_orders ao
    JOIN cohort c ON c.id = ao.creator_id
    WHERE ao.organization_id = p_org_id
      AND timezone('America/Bogota', ao.order_date)::date >= v_week_start
      AND timezone('America/Bogota', ao.order_date)::date < v_week_end
  ),
  month_orders AS (
    SELECT ao.*
    FROM ugc_attributed_orders ao
    JOIN cohort c ON c.id = ao.creator_id
    WHERE ao.organization_id = p_org_id
      AND timezone('America/Bogota', ao.order_date)::date >= v_month_start
      AND timezone('America/Bogota', ao.order_date)::date < v_month_end
  ),
  week_clicks AS (
    SELECT lc.*
    FROM ugc_link_clicks lc
    JOIN cohort c ON c.id = lc.creator_id
    WHERE lc.organization_id = p_org_id
      AND timezone('America/Bogota', lc.clicked_at)::date >= v_week_start
      AND timezone('America/Bogota', lc.clicked_at)::date < v_week_end
  ),
  month_clicks AS (
    SELECT lc.*
    FROM ugc_link_clicks lc
    JOIN cohort c ON c.id = lc.creator_id
    WHERE lc.organization_id = p_org_id
      AND timezone('America/Bogota', lc.clicked_at)::date >= v_month_start
      AND timezone('America/Bogota', lc.clicked_at)::date < v_month_end
  ),
  week_videos AS (
    SELECT v.*
    FROM ugc_videos v
    JOIN cohort c ON c.id = v.creator_id
    WHERE v.organization_id = p_org_id
      AND COALESCE(v.published_date, timezone('America/Bogota', v.created_at)::date) >= v_week_start
      AND COALESCE(v.published_date, timezone('America/Bogota', v.created_at)::date) < v_week_end
  ),
  month_videos AS (
    SELECT v.*
    FROM ugc_videos v
    JOIN cohort c ON c.id = v.creator_id
    WHERE v.organization_id = p_org_id
      AND COALESCE(v.published_date, timezone('America/Bogota', v.created_at)::date) >= v_month_start
      AND COALESCE(v.published_date, timezone('America/Bogota', v.created_at)::date) < v_month_end
  ),
  goals AS (
    SELECT *
    FROM ugc_affiliate_monthly_goals
    WHERE organization_id = p_org_id
      AND month_start = v_month_start
    LIMIT 1
  ),
  top_earners AS (
    SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.commission DESC) AS rows
    FROM (
      SELECT
        c.name,
        c.instagram_handle,
        COUNT(wo.id)::int AS orders,
        COALESCE(SUM(wo.order_total), 0) AS revenue,
        COALESCE(SUM(wo.commission_amount), 0) AS commission
      FROM cohort c
      JOIN week_orders wo ON wo.creator_id = c.id
      GROUP BY c.id, c.name, c.instagram_handle
      ORDER BY commission DESC
      LIMIT 10
    ) x
  ),
  reactivation AS (
    SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.name) AS rows
    FROM (
      SELECT c.name, c.instagram_handle
      FROM cohort c
      JOIN active_links al ON al.creator_id = c.id
      WHERE NOT EXISTS (SELECT 1 FROM week_orders wo WHERE wo.creator_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM week_clicks wc WHERE wc.creator_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM week_videos wv WHERE wv.creator_id = c.id)
      LIMIT 20
    ) x
  )
  SELECT jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'month_start', v_month_start,
    'cohort_tag', p_tag_name,
    'goals', COALESCE(to_jsonb((SELECT g FROM goals g)), jsonb_build_object(
      'revenue_goal', 6000000,
      'stretch_revenue_goal', 10000000,
      'orders_goal', 25,
      'converting_creators_goal', 10,
      'active_creators_goal', 40,
      'weekly_active_creators_goal', 20,
      'content_pieces_goal', 120,
      'active_links_goal', 90
    )),
    'cohort', jsonb_build_object(
      'creators', (SELECT COUNT(*) FROM cohort),
      'active_links', (SELECT COUNT(*) FROM active_links),
      'link_activation_rate', ROUND(((SELECT COUNT(*) FROM active_links)::numeric / NULLIF((SELECT COUNT(*) FROM cohort), 0)) * 100, 1)
    ),
    'week', jsonb_build_object(
      'orders', (SELECT COUNT(*) FROM week_orders),
      'revenue', COALESCE((SELECT SUM(order_total) FROM week_orders), 0),
      'commission', COALESCE((SELECT SUM(commission_amount) FROM week_orders), 0),
      'discount', COALESCE((SELECT SUM(discount_amount) FROM week_orders), 0),
      'converting_creators', (SELECT COUNT(DISTINCT creator_id) FROM week_orders),
      'clicks', (SELECT COUNT(*) FROM week_clicks),
      'clicking_creators', (SELECT COUNT(DISTINCT creator_id) FROM week_clicks),
      'content_pieces', (SELECT COUNT(*) FROM week_videos),
      'content_creators', (SELECT COUNT(DISTINCT creator_id) FROM week_videos),
      'active_creators', (
        SELECT COUNT(DISTINCT creator_id)
        FROM (
          SELECT creator_id FROM week_orders
          UNION SELECT creator_id FROM week_clicks
          UNION SELECT creator_id FROM week_videos
        ) a
      )
    ),
    'month_to_date', jsonb_build_object(
      'orders', (SELECT COUNT(*) FROM month_orders),
      'revenue', COALESCE((SELECT SUM(order_total) FROM month_orders), 0),
      'commission', COALESCE((SELECT SUM(commission_amount) FROM month_orders), 0),
      'converting_creators', (SELECT COUNT(DISTINCT creator_id) FROM month_orders),
      'clicks', (SELECT COUNT(*) FROM month_clicks),
      'clicking_creators', (SELECT COUNT(DISTINCT creator_id) FROM month_clicks),
      'content_pieces', (SELECT COUNT(*) FROM month_videos),
      'content_creators', (SELECT COUNT(DISTINCT creator_id) FROM month_videos)
    ),
    'top_earners', COALESCE((SELECT rows FROM top_earners), '[]'::jsonb),
    'reactivation_candidates', COALESCE((SELECT rows FROM reactivation), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_ugc_affiliate_weekly_report(uuid, date, text, date) TO authenticated;
