-- Fix calculate_delivery_payment: distinguish "anticipo" (order-level) from
-- "pago anticipado" (delivery-level).
--
-- order_advances stores BOTH concepts in the same table, discriminated by
-- delivery_id:
--   * delivery_id IS NULL  -> "anticipo": tied to the order, pools across all
--                             deliveries of that order+workshop.
--   * delivery_id = <id>    -> "pago anticipado": tied to ONE specific delivery,
--                             must only be deducted from that delivery's payment.
--
-- The previous version summed all advances for the order+workshop ignoring
-- delivery_id, so a pago anticipado registered for delivery A was wrongly
-- deducted from sibling delivery B's payment.
DROP FUNCTION IF EXISTS public.calculate_delivery_payment(uuid, numeric);
DROP FUNCTION IF EXISTS public.calculate_delivery_payment(uuid);

CREATE OR REPLACE FUNCTION public.calculate_delivery_payment(
  delivery_id_param uuid,
  custom_advance_deduction_param numeric DEFAULT NULL::numeric
)
RETURNS TABLE(
  total_units integer,
  billable_units integer,
  gross_amount numeric,
  advance_deduction numeric,
  net_amount numeric,
  workshop_payment_method text,
  total_advance_available numeric,
  advance_already_used numeric,
  items_without_workshop_price integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workshop_method TEXT;
  workshop_id_param UUID;
  order_id_param UUID;
  total_delivered INTEGER := 0;
  total_billable INTEGER := 0;
  gross_total NUMERIC := 0;
  advance_total NUMERIC := 0;
  advance_used NUMERIC := 0;
  advance_to_deduct NUMERIC := 0;
  net_total NUMERIC := 0;
  missing_price_count INTEGER := 0;
BEGIN
  -- Obtener el método de pago, workshop_id y order_id
  SELECT w.payment_method, d.workshop_id, d.order_id
  INTO workshop_method, workshop_id_param, order_id_param
  FROM deliveries d
  JOIN workshops w ON d.workshop_id = w.id
  WHERE d.id = delivery_id_param;

  -- Si no se encuentra, usar 'approved' por defecto
  IF workshop_method IS NULL THEN
    workshop_method := 'approved';
  END IF;

  -- Calcular totales de la entrega
  SELECT
    COALESCE(SUM(di.quantity_delivered), 0),
    CASE
      WHEN workshop_method = 'approved' THEN COALESCE(SUM(di.quantity_approved), 0)
      ELSE COALESCE(SUM(di.quantity_delivered), 0)
    END
  INTO total_delivered, total_billable
  FROM delivery_items di
  WHERE di.delivery_id = delivery_id_param;

  -- Calcular monto bruto usando precios específicos del taller
  -- LATERAL subquery ensures we pick only the MOST RECENT active price per product
  -- Also count items that have no workshop pricing configured
  SELECT COALESCE(SUM(
    CASE
      WHEN workshop_method = 'approved' THEN
        di.quantity_approved * COALESCE(wp.unit_price, oi.unit_price)
      ELSE
        di.quantity_delivered * COALESCE(wp.unit_price, oi.unit_price)
    END
  ), 0),
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

  -- Calcular anticipo total disponible PARA ESTA ENTREGA:
  --   * anticipos a nivel de orden (delivery_id IS NULL): se reparten en la orden
  --   * pagos anticipados de ESTA entrega (delivery_id = delivery_id_param)
  -- Se EXCLUYEN los pagos anticipados atados a OTRAS entregas.
  SELECT COALESCE(SUM(oa.amount), 0) INTO advance_total
  FROM order_advances oa
  WHERE oa.order_id = order_id_param
    AND oa.workshop_id = workshop_id_param
    AND (oa.delivery_id IS NULL OR oa.delivery_id = delivery_id_param);

  -- Calcular anticipo de ORDEN ya consumido por OTRAS entregas.
  -- Solo se cuenta la porción que salió del pool de orden: la deducción de cada
  -- otra entrega menos su propio pago anticipado (atribución: primero se consume
  -- el pago anticipado propio de la entrega, el excedente sale del pool de orden).
  -- Así, descontar el pago anticipado propio de otra entrega NO reduce el pool de
  -- orden disponible para esta entrega.
  SELECT COALESCE(SUM(
    GREATEST(
      0,
      (CASE
         WHEN dp.custom_advance_deduction IS NOT NULL THEN dp.custom_advance_deduction
         ELSE dp.advance_deduction
       END) - COALESCE(own_pago.total, 0)
    )
  ), 0) INTO advance_used
  FROM delivery_payments dp
  LEFT JOIN LATERAL (
    SELECT SUM(oa2.amount) AS total
    FROM order_advances oa2
    WHERE oa2.delivery_id = dp.delivery_id
  ) own_pago ON true
  WHERE dp.order_id = order_id_param
    AND dp.workshop_id = workshop_id_param
    AND dp.delivery_id <> delivery_id_param;

  -- Determinar deducción de anticipo a usar
  IF custom_advance_deduction_param IS NOT NULL THEN
    advance_to_deduct := LEAST(custom_advance_deduction_param, advance_total - advance_used);
  ELSE
    advance_to_deduct := LEAST(advance_total - advance_used, gross_total);
  END IF;

  -- Asegurar que no sea negativa
  advance_to_deduct := GREATEST(0, advance_to_deduct);

  -- Calcular monto neto
  net_total := gross_total - advance_to_deduct;

  RETURN QUERY SELECT
    total_delivered,
    total_billable,
    gross_total,
    advance_to_deduct,
    net_total,
    workshop_method,
    advance_total,
    advance_used,
    missing_price_count;
END;
$function$;
