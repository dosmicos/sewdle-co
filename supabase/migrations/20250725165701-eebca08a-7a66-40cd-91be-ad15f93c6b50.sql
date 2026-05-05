-- Crear o reemplazar la función calculate_delivery_payment
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
  total_delivered INTEGER := 0;
  total_billable INTEGER := 0;
  unit_price_val NUMERIC := 0;
  gross_total NUMERIC := 0;
  advance_total NUMERIC := 0;
  net_total NUMERIC := 0;
BEGIN
  -- Obtener el método de pago del taller
  SELECT w.payment_method INTO workshop_method
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
    END,
    COALESCE(AVG(oi.unit_price), 0)
  INTO total_delivered, total_billable, unit_price_val
  FROM delivery_items di
  JOIN order_items oi ON di.order_item_id = oi.id
  WHERE di.delivery_id = delivery_id_param;
  
  -- Calcular monto bruto
  gross_total := total_billable * unit_price_val;
  
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
$$ LANGUAGE plpgsql;