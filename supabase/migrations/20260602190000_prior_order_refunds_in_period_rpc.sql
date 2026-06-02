-- Refund-date attribution for Net Sales (Shopify "Total Sales over time" model).
--
-- Shopify's tooltip: "Revenue values are based on the order date; refund values
-- are based on the refund date." Our dashboard computes Net Sales on order-date
-- net revenue (each order's current_total_price). That over-reports vs Shopify
-- by the amount of refunds ISSUED in the period for orders PLACED in earlier
-- periods — Shopify subtracts those from the period; we did not.
--
-- This function returns exactly that amount so prophit-metrics can subtract it,
-- aligning the headline Net Sales with Shopify (within ~1–2%; the residual is
-- Shopify's internal tax-inclusive / refund-line accounting which can't be
-- replicated to the peso from the stored data).
--
-- Refund amount per refund = refunded merchandise (refund_line_items.subtotal)
-- + refunded shipping/other (order_adjustments, stored negative → abs). Tax is
-- already inside subtotal for this tax-inclusive store, so it is not re-added.
CREATE OR REPLACE FUNCTION public.prior_order_refunds_in_period(
  p_org uuid,
  p_start timestamptz,
  p_end timestamptz
) RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    COALESCE((SELECT SUM((rli->>'subtotal')::numeric)
              FROM jsonb_array_elements(ref->'refund_line_items') rli), 0)
    + COALESCE((SELECT SUM(ABS((adj->>'amount')::numeric))
                FROM jsonb_array_elements(ref->'order_adjustments') adj), 0)
  ), 0)::numeric
  FROM shopify_orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.raw_data->'refunds') ref
  WHERE o.organization_id = p_org
    AND o.created_at_shopify < p_start
    AND o.created_at_shopify >= (p_start - INTERVAL '180 days')
    AND jsonb_array_length(COALESCE(o.raw_data->'refunds','[]'::jsonb)) > 0
    AND (ref->>'created_at')::timestamptz >= p_start
    AND (ref->>'created_at')::timestamptz <= p_end;
$$;

GRANT EXECUTE ON FUNCTION public.prior_order_refunds_in_period(uuid, timestamptz, timestamptz)
  TO anon, authenticated, service_role;
