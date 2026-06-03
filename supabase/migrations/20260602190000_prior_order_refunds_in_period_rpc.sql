-- ─── prior_order_refunds_in_period ──────────────────────────────────
-- Refund-date attribution for Net Sales, matching Shopify's
-- "Total Sales over time" model:
--   "Revenue values are based on the order date;
--    refund values are based on the refund date."
--
-- prophit-metrics computes order-date net revenue from each period order's
-- current_total_price (already net of its OWN refunds). That misses refunds
-- ISSUED inside the period for orders PLACED in earlier periods — Shopify
-- subtracts those on the refund date. Without this, the dashboard over-reports
-- Net Sales vs Shopify by the amount of prior-period refunds processed
-- in-window (audit: Jun 1 over-reported by ~908K → 13.24M instead of ~12.33M).
--
-- Sums, for refunds created within [p_start, p_end] on orders placed before
-- p_start (bounded 180-day lookback for index/perf):
--   refund_line_items.subtotal  (pre-tax value of returned goods)
--   + |order_adjustments.amount| (shipping refunds / restocking adjustments)
-- traversing the raw_data->'refunds' JSONB embedded on each order.
--
-- SECURITY DEFINER so it can read shopify_orders regardless of the caller's
-- RLS context (prophit-metrics calls it from the dashboard with the user's
-- JWT). search_path pinned to public to prevent search_path hijacking.

CREATE OR REPLACE FUNCTION public.prior_order_refunds_in_period(
  p_org uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    COALESCE((SELECT SUM((rli->>'subtotal')::numeric)
              FROM jsonb_array_elements(ref->'refund_line_items') rli), 0)
    + COALESCE((SELECT SUM(ABS((adj->>'amount')::numeric))
                FROM jsonb_array_elements(ref->'order_adjustments') adj), 0)
  ), 0)::numeric
  FROM shopify_orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.raw_data->'refunds') ref
  WHERE o.organization_id = p_org
    AND o.created_at_shopify < p_start                          -- order placed BEFORE the period
    AND o.created_at_shopify >= (p_start - INTERVAL '180 days') -- bounded lookback for performance
    AND jsonb_array_length(COALESCE(o.raw_data->'refunds','[]'::jsonb)) > 0
    AND (ref->>'created_at')::timestamptz >= p_start            -- refund issued within the period
    AND (ref->>'created_at')::timestamptz <= p_end;
$function$;

GRANT EXECUTE ON FUNCTION public.prior_order_refunds_in_period(uuid, timestamptz, timestamptz)
  TO authenticated, anon, service_role;
