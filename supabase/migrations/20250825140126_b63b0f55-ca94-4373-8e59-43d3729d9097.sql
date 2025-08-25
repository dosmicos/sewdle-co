-- Add custom advance deduction control to delivery payments
ALTER TABLE public.delivery_payments 
ADD COLUMN custom_advance_deduction numeric DEFAULT NULL,
ADD COLUMN advance_notes text DEFAULT NULL;

-- Update the calculate_delivery_payment function to support custom advance deduction
CREATE OR REPLACE FUNCTION public.calculate_delivery_payment(
  delivery_id_param uuid,
  custom_advance_deduction_param numeric DEFAULT NULL
)
RETURNS TABLE(
  total_units integer, 
  billable_units integer, 
  gross_amount numeric, 
  advance_deduction numeric, 
  net_amount numeric, 
  workshop_payment_method text,
  total_advance_available numeric,
  advance_already_used numeric
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
  SELECT COALESCE(SUM(
    CASE 
      WHEN workshop_method = 'approved' THEN 
        di.quantity_approved * COALESCE(wp.unit_price, oi.unit_price)
      ELSE 
        di.quantity_delivered * COALESCE(wp.unit_price, oi.unit_price)
    END
  ), 0)
  INTO gross_total
  FROM delivery_items di
  JOIN order_items oi ON di.order_item_id = oi.id
  JOIN product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN workshop_pricing wp ON workshop_id_param = wp.workshop_id 
    AND pv.product_id = wp.product_id
    AND wp.effective_from <= CURRENT_DATE
    AND (wp.effective_until IS NULL OR wp.effective_until > CURRENT_DATE)
  WHERE di.delivery_id = delivery_id_param;
  
  -- Calcular anticipo total disponible
  SELECT COALESCE(SUM(oa.amount), 0) INTO advance_total
  FROM order_advances oa
  WHERE oa.order_id = order_id_param AND oa.workshop_id = workshop_id_param;
  
  -- Calcular anticipo ya usado en otras entregas
  SELECT COALESCE(SUM(
    CASE 
      WHEN dp.custom_advance_deduction IS NOT NULL THEN dp.custom_advance_deduction
      ELSE dp.advance_deduction
    END
  ), 0) INTO advance_used
  FROM delivery_payments dp
  WHERE dp.order_id = order_id_param 
    AND dp.workshop_id = workshop_id_param 
    AND dp.delivery_id != delivery_id_param;
  
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
    advance_used;
END;
$function$;