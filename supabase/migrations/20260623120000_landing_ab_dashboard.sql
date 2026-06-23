-- Landing A/B testing dashboard: experiments registry + visit tracking + order-stats RPC.
-- Powers the "A/B Landings" module in growth.sewdle.co.
-- The split runs IN THE LANDING (cookie 50/50, not Meta). Orders carry lp_version in
-- shopify_orders.raw_data->note_attributes; visits are counted here (denominator for CVR).

-- 1. Registry of experiments (one row per A/B test) ---------------------------------------
CREATE TABLE IF NOT EXISTS landing_ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  control_lp_version TEXT NOT NULL,
  control_label TEXT,
  challenger_lp_version TEXT NOT NULL,
  challenger_label TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- running | decided | archived
  winner_lp_version TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_landing_ab_experiments_org
  ON landing_ab_experiments(organization_id, status);

-- 2. Visit tracking: one row per NEW visitor bucketed by the split (denominator for CVR) ---
CREATE TABLE IF NOT EXISTS landing_ab_visits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  experiment_slug TEXT NOT NULL,
  lp_version TEXT NOT NULL,
  lp_bucket TEXT,
  anon_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_ab_visits_lookup
  ON landing_ab_visits(organization_id, experiment_slug, lp_version, occurred_at DESC);

-- De-dup guard: never double-count the same visitor within an experiment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_landing_ab_visits_anon
  ON landing_ab_visits(organization_id, experiment_slug, anon_id)
  WHERE anon_id IS NOT NULL;

-- 3. RLS ----------------------------------------------------------------------------------
ALTER TABLE landing_ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_ab_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View experiments for own org" ON landing_ab_experiments FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
CREATE POLICY "Service role manages experiments" ON landing_ab_experiments FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "View visits for own org" ON landing_ab_visits FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM organization_users WHERE user_id = auth.uid()));
CREATE POLICY "Service role manages visits" ON landing_ab_visits FOR ALL
  USING (true) WITH CHECK (true);

-- 4. RPC: orders + revenue per lp_version per day -----------------------------------------
-- Extracts lp_version from raw_data->note_attributes so the dashboard doesn't parse JSON per request.
CREATE OR REPLACE FUNCTION landing_ab_order_stats(p_org UUID, p_start DATE, p_end DATE)
RETURNS TABLE (lp_version TEXT, day DATE, orders BIGINT, revenue NUMERIC)
LANGUAGE sql STABLE AS $$
  WITH tagged AS (
    SELECT
      (SELECT na->>'value'
         FROM jsonb_array_elements(o.raw_data->'note_attributes') na
         WHERE na->>'name' = 'lp_version' LIMIT 1) AS lp_version,
      (o.created_at_shopify AT TIME ZONE 'America/Bogota')::date AS day,
      o.total_price AS total_price
    FROM shopify_orders o
    WHERE o.organization_id = p_org
      AND o.created_at_shopify >= (p_start::timestamp AT TIME ZONE 'America/Bogota')
      AND o.created_at_shopify <  ((p_end + 1)::timestamp AT TIME ZONE 'America/Bogota')
      AND jsonb_typeof(o.raw_data->'note_attributes') = 'array'
  )
  SELECT lp_version, day, count(*)::bigint AS orders, coalesce(sum(total_price), 0) AS revenue
  FROM tagged
  WHERE lp_version IS NOT NULL
  GROUP BY lp_version, day;
$$;

GRANT EXECUTE ON FUNCTION landing_ab_order_stats(UUID, DATE, DATE) TO authenticated, service_role;

-- 5. Seed the running ruanas experiment ---------------------------------------------------
INSERT INTO landing_ab_experiments
  (organization_id, slug, name, destination_path,
   control_lp_version, control_label, challenger_lp_version, challenger_label, started_at, status)
VALUES
  ('cb497af2-3f29-4bb4-be53-91b7f19e5ffb', 'ruanas-magica-vs-animalitos',
   'Ruanas — Magia y practicidad vs Ángulo animalitos', '/collections/ruanas',
   'ruanas_magica', 'Magia y practicidad',
   'ruanas_animalitos', 'No tienes que rogarle (animalitos)',
   '2026-06-22T00:00:00-05:00', 'running')
ON CONFLICT (organization_id, slug) DO NOTHING;
