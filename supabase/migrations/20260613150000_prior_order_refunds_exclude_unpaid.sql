-- Net Sales vs Shopify: stop subtracting refunds on never-paid orders.
--
-- Symptom: yesterday's Net Sales in Sewdle was ~9% BELOW Shopify's "Total
-- Sales over time" (e.g. Jun 12: Sewdle 10,867,585 vs Shopify 11,935,885).
--
-- Root cause: prior_order_refunds_in_period summed refund_line_items.subtotal
-- for ALL refunds issued in the period, including COD orders that were
-- cancelled/voided while still UNPAID (financial_status pending/voided). Those
-- "refunds" are inventory restocks with $0 money returned (verified: 0 of them
-- have a successful refund transaction). Shopify does not reduce Total Sales for
-- them, so the dashboard over-subtracted and under-reported revenue.
--
-- Fix: only count refunds on orders that were actually paid (exclude
-- pending/voided). Validated: Jun 12 now 11,971,485 vs Shopify 11,935,885
-- (+0.3%, vs -9% before); across 60 days, NO excluded refund had real money.
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
    AND COALESCE(o.financial_status,'') NOT IN ('pending','voided') -- exclude never-paid (COD cancel/restock, $0 returned)
    AND jsonb_array_length(COALESCE(o.raw_data->'refunds','[]'::jsonb)) > 0
    AND (ref->>'created_at')::timestamptz >= p_start            -- refund issued within the period
    AND (ref->>'created_at')::timestamptz <= p_end;
$function$;

GRANT EXECUTE ON FUNCTION public.prior_order_refunds_in_period(uuid, timestamptz, timestamptz)
  TO authenticated, anon, service_role;
