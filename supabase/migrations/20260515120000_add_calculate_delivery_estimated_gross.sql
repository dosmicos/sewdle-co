-- Adds calculate_delivery_estimated_gross: returns the gross amount of a delivery
-- treating quantity_delivered as billable, regardless of the workshop payment_method.
-- Used by the "Pago Anticipado" UI to register an advance before quality review,
-- when quantity_approved is still 0.

CREATE OR REPLACE FUNCTION public.calculate_delivery_estimated_gross(
  delivery_id_param uuid
)
RETURNS TABLE(
  total_units integer,
  estimated_gross numeric,
  items_without_workshop_price integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workshop_id_param UUID;
  total_delivered INTEGER := 0;
  gross_total NUMERIC := 0;
  missing_price_count INTEGER := 0;
BEGIN
  SELECT d.workshop_id INTO workshop_id_param
  FROM deliveries d
  WHERE d.id = delivery_id_param;

  SELECT COALESCE(SUM(di.quantity_delivered), 0)
  INTO total_delivered
  FROM delivery_items di
  WHERE di.delivery_id = delivery_id_param;

  SELECT
    COALESCE(SUM(di.quantity_delivered * COALESCE(wp.unit_price, oi.unit_price)), 0),
    COALESCE(SUM(CASE WHEN wp.unit_price IS NULL THEN 1 ELSE 0 END), 0)
  INTO gross_total, missing_price_count
  FROM delivery_items di
  JOIN order_items oi ON di.order_item_id = oi.id
  JOIN product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN LATERAL (
    SELECT wp_inner.unit_price
    FROM workshop_pricing wp_inner
    WHERE wp_inner.workshop_id = workshop_id_param
      AND wp_inner.product_id = pv.product_id
      AND wp_inner.effective_from <= CURRENT_DATE
      AND (wp_inner.effective_until IS NULL OR wp_inner.effective_until > CURRENT_DATE)
    ORDER BY wp_inner.effective_from DESC
    LIMIT 1
  ) wp ON true
  WHERE di.delivery_id = delivery_id_param;

  RETURN QUERY SELECT total_delivered, gross_total, missing_price_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calculate_delivery_estimated_gross(uuid) TO authenticated;
