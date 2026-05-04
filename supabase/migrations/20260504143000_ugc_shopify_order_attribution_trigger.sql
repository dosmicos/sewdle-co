-- Robust UGC attribution from synced Shopify orders
-- Ensures orders that use a UGC discount code are attributed even if the Shopify webhook misses/fails.

CREATE OR REPLACE FUNCTION public.recompute_ugc_discount_link_totals(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ugc_discount_links dl
  SET
    total_orders = stats.total_orders,
    total_revenue = stats.total_revenue,
    total_commission = stats.total_commission,
    updated_at = now()
  FROM (
    SELECT
      COUNT(*)::integer AS total_orders,
      COALESCE(SUM(order_total), 0)::numeric AS total_revenue,
      COALESCE(SUM(commission_amount), 0)::numeric AS total_commission
    FROM public.ugc_attributed_orders
    WHERE discount_link_id = p_link_id
  ) stats
  WHERE dl.id = p_link_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_ugc_order_attribution_from_shopify_order(p_shopify_order_id bigint)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.shopify_orders%ROWTYPE;
  v_link public.ugc_discount_links%ROWTYPE;
  v_existing_link_id uuid;
  v_attributed_order_id uuid;
  v_order_revenue numeric;
  v_discount_amount numeric;
  v_commission_amount numeric;
BEGIN
  SELECT * INTO v_order
  FROM public.shopify_orders
  WHERE shopify_order_id = p_shopify_order_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT discount_link_id INTO v_existing_link_id
  FROM public.ugc_attributed_orders
  WHERE shopify_order_id = v_order.shopify_order_id::text
  LIMIT 1;

  -- Remove attribution for cancelled/voided/refunded orders and recompute prior link totals.
  IF v_order.cancelled_at IS NOT NULL
     OR lower(COALESCE(v_order.financial_status, '')) IN ('refunded', 'voided') THEN
    DELETE FROM public.ugc_attributed_orders
    WHERE shopify_order_id = v_order.shopify_order_id::text;

    IF v_existing_link_id IS NOT NULL THEN
      PERFORM public.recompute_ugc_discount_link_totals(v_existing_link_id);
    END IF;

    RETURN NULL;
  END IF;

  -- Match against either Shopify discount_codes or discount_applications payloads.
  WITH order_codes AS (
    SELECT upper(trim(code_value)) AS code
    FROM (
      SELECT elem->>'code' AS code_value
      FROM jsonb_array_elements(COALESCE(v_order.raw_data->'discount_codes', '[]'::jsonb)) elem
      UNION
      SELECT elem->>'code' AS code_value
      FROM jsonb_array_elements(COALESCE(v_order.raw_data->'discount_applications', '[]'::jsonb)) elem
    ) codes
    WHERE code_value IS NOT NULL AND trim(code_value) <> ''
  )
  SELECT dl.* INTO v_link
  FROM public.ugc_discount_links dl
  JOIN order_codes oc
    ON upper(trim(dl.shopify_discount_code)) = oc.code
  WHERE dl.is_active = true
    AND dl.organization_id = v_order.organization_id
  ORDER BY dl.created_at DESC
  LIMIT 1;

  -- If the order no longer has a matching active UGC code, remove old attribution if any.
  IF NOT FOUND THEN
    DELETE FROM public.ugc_attributed_orders
    WHERE shopify_order_id = v_order.shopify_order_id::text;

    IF v_existing_link_id IS NOT NULL THEN
      PERFORM public.recompute_ugc_discount_link_totals(v_existing_link_id);
    END IF;

    RETURN NULL;
  END IF;

  v_order_revenue := COALESCE(v_order.subtotal_price, v_order.total_price, 0);
  v_discount_amount := COALESCE(v_order.total_discounts, 0);
  v_commission_amount := ROUND((v_order_revenue * COALESCE(v_link.commission_rate, 0) / 100)::numeric, 2);

  INSERT INTO public.ugc_attributed_orders (
    organization_id,
    discount_link_id,
    creator_id,
    shopify_order_id,
    shopify_order_number,
    order_total,
    discount_amount,
    commission_amount,
    order_date
  )
  VALUES (
    v_link.organization_id,
    v_link.id,
    v_link.creator_id,
    v_order.shopify_order_id::text,
    v_order.order_number,
    v_order_revenue,
    v_discount_amount,
    v_commission_amount,
    COALESCE(v_order.created_at_shopify, v_order.shopify_created_at, v_order.created_at, now())
  )
  ON CONFLICT (shopify_order_id) DO UPDATE
  SET
    organization_id = EXCLUDED.organization_id,
    discount_link_id = EXCLUDED.discount_link_id,
    creator_id = EXCLUDED.creator_id,
    shopify_order_number = EXCLUDED.shopify_order_number,
    order_total = EXCLUDED.order_total,
    discount_amount = EXCLUDED.discount_amount,
    commission_amount = EXCLUDED.commission_amount,
    order_date = EXCLUDED.order_date
  RETURNING id INTO v_attributed_order_id;

  IF v_existing_link_id IS NOT NULL AND v_existing_link_id <> v_link.id THEN
    PERFORM public.recompute_ugc_discount_link_totals(v_existing_link_id);
  END IF;

  PERFORM public.recompute_ugc_discount_link_totals(v_link.id);

  RETURN v_attributed_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ugc_order_attribution_from_shopify_order_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_ugc_order_attribution_from_shopify_order(NEW.shopify_order_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ugc_order_attribution_from_shopify_order ON public.shopify_orders;
CREATE TRIGGER trg_sync_ugc_order_attribution_from_shopify_order
AFTER INSERT OR UPDATE OF raw_data, financial_status, cancelled_at, subtotal_price, total_price, total_discounts, created_at_shopify, shopify_created_at, order_number
ON public.shopify_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_ugc_order_attribution_from_shopify_order_trigger();

-- Backfill all existing Shopify orders that already contain a known active UGC code.
DO $$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    WITH order_codes AS (
      SELECT DISTINCT o.shopify_order_id
      FROM public.shopify_orders o
      CROSS JOIN LATERAL (
        SELECT elem->>'code' AS code_value
        FROM jsonb_array_elements(COALESCE(o.raw_data->'discount_codes', '[]'::jsonb)) elem
        UNION
        SELECT elem->>'code' AS code_value
        FROM jsonb_array_elements(COALESCE(o.raw_data->'discount_applications', '[]'::jsonb)) elem
      ) codes
      JOIN public.ugc_discount_links dl
        ON upper(trim(dl.shopify_discount_code)) = upper(trim(codes.code_value))
       AND dl.is_active = true
       AND dl.organization_id = o.organization_id
      WHERE codes.code_value IS NOT NULL AND trim(codes.code_value) <> ''
    )
    SELECT shopify_order_id FROM order_codes
  LOOP
    PERFORM public.sync_ugc_order_attribution_from_shopify_order(v_order.shopify_order_id);
  END LOOP;
END;
$$;
