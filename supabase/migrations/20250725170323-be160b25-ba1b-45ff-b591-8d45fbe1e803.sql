-- Corregir la función calculate_delivery_payment para usar precios del taller
CREATE OR REPLACE FUNCTION calculate_delivery_payment(delivery_id_param UUID)
RETURNS TABLE (
  total_units INTEGER,
  billable_units INTEGER,
  gross_amount NUMERIC,
  advance_deduction NUMERIC,
  net_amount NUMERIC,
  workshop_payment_method TEXT
) AS $$
DECLARE
  workshop_method TEXT;
  workshop_id_param UUID;
  total_delivered INTEGER := 0;
  total_billable INTEGER := 0;
  gross_total NUMERIC := 0;
  advance_total NUMERIC := 0;
  net_total NUMERIC := 0;
BEGIN
  -- Obtener el método de pago y workshop_id del taller
  SELECT w.payment_method, d.workshop_id INTO workshop_method, workshop_id_param
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
  
  -- CORREGIR: Calcular monto bruto usando precios específicos del taller
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
  
  -- Calcular deducción de anticipos
  SELECT COALESCE(SUM(oa.amount), 0) INTO advance_total
  FROM deliveries d
  JOIN order_advances oa ON d.order_id = oa.order_id AND d.workshop_id = oa.workshop_id
  WHERE d.id = delivery_id_param;
  
  -- Calcular monto neto
  net_total := gross_total - advance_total;
  
  RETURN QUERY SELECT 
    total_delivered,
    total_billable,
    gross_total,
    advance_total,
    net_total,
    workshop_method;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;