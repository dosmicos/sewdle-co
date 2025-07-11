-- Financial Module Implementation - Phase 2: Database Functions

-- Function to get current pricing for a workshop-product combination
CREATE OR REPLACE FUNCTION public.get_workshop_product_price(
  workshop_id_param UUID,
  product_id_param UUID,
  calculation_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(10,2)
LANGUAGE SQL
STABLE
AS $$
  SELECT wp.unit_price
  FROM public.workshop_pricing wp
  WHERE wp.workshop_id = workshop_id_param
    AND wp.product_id = product_id_param
    AND wp.effective_from <= calculation_date
    AND (wp.effective_until IS NULL OR wp.effective_until > calculation_date)
  ORDER BY wp.effective_from DESC
  LIMIT 1;
$$;

-- Function to calculate payment amount for a delivery
CREATE OR REPLACE FUNCTION public.calculate_delivery_payment(
  delivery_id_param UUID
)
RETURNS TABLE(
  total_units INTEGER,
  billable_units INTEGER,
  gross_amount NUMERIC(10,2),
  advance_deduction NUMERIC(10,2),
  net_amount NUMERIC(10,2),
  workshop_payment_method TEXT
)
LANGUAGE PLPGSQL
STABLE
AS $$
DECLARE
  delivery_record RECORD;
  workshop_record RECORD;
  item_record RECORD;
  current_total_units INTEGER := 0;
  current_billable_units INTEGER := 0;
  current_gross_amount NUMERIC(10,2) := 0;
  current_advance_deduction NUMERIC(10,2) := 0;
  item_price NUMERIC(10,2);
  item_billable INTEGER;
BEGIN
  -- Get delivery information
  SELECT d.*, o.id as order_id
  INTO delivery_record
  FROM public.deliveries d
  JOIN public.orders o ON d.order_id = o.id
  WHERE d.id = delivery_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery not found: %', delivery_id_param;
  END IF;
  
  -- Get workshop information
  SELECT w.*
  INTO workshop_record
  FROM public.workshops w
  WHERE w.id = delivery_record.workshop_id;
  
  -- Calculate totals by iterating through delivery items
  FOR item_record IN
    SELECT 
      di.*,
      pv.product_id,
      di.quantity_delivered,
      di.quantity_approved
    FROM public.delivery_items di
    JOIN public.order_items oi ON di.order_item_id = oi.id
    JOIN public.product_variants pv ON oi.product_variant_id = pv.id
    WHERE di.delivery_id = delivery_id_param
  LOOP
    -- Get price for this workshop-product combination
    SELECT public.get_workshop_product_price(
      delivery_record.workshop_id,
      item_record.product_id,
      delivery_record.delivery_date
    ) INTO item_price;
    
    -- Skip if no price configured
    IF item_price IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Determine billable units based on workshop payment method
    IF workshop_record.payment_method = 'approved' THEN
      item_billable := COALESCE(item_record.quantity_approved, 0);
    ELSE -- 'delivered'
      item_billable := COALESCE(item_record.quantity_delivered, 0);
    END IF;
    
    -- Add to totals
    current_total_units := current_total_units + COALESCE(item_record.quantity_delivered, 0);
    current_billable_units := current_billable_units + item_billable;
    current_gross_amount := current_gross_amount + (item_billable * item_price);
  END LOOP;
  
  -- Calculate advance deduction
  SELECT COALESCE(SUM(oa.amount), 0)
  INTO current_advance_deduction
  FROM public.order_advances oa
  WHERE oa.order_id = delivery_record.order_id
    AND oa.workshop_id = delivery_record.workshop_id;
  
  -- Return results
  total_units := current_total_units;
  billable_units := current_billable_units;
  gross_amount := current_gross_amount;
  advance_deduction := LEAST(current_advance_deduction, current_gross_amount);
  net_amount := current_gross_amount - advance_deduction;
  workshop_payment_method := workshop_record.payment_method;
  
  RETURN NEXT;
END;
$$;

-- Function to get financial summary for a workshop
CREATE OR REPLACE FUNCTION public.get_workshop_financial_summary(
  workshop_id_param UUID,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  total_deliveries INTEGER,
  pending_payments INTEGER,
  paid_deliveries INTEGER,
  total_gross_amount NUMERIC(10,2),
  total_advances NUMERIC(10,2),
  total_net_amount NUMERIC(10,2),
  total_paid_amount NUMERIC(10,2),
  pending_amount NUMERIC(10,2)
)
LANGUAGE SQL
STABLE
AS $$
  WITH delivery_stats AS (
    SELECT 
      COUNT(*) as delivery_count,
      COUNT(*) FILTER (WHERE dp.payment_status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE dp.payment_status = 'paid') as paid_count,
      COALESCE(SUM(dp.gross_amount), 0) as gross_total,
      COALESCE(SUM(dp.advance_deduction), 0) as advance_total,
      COALESCE(SUM(dp.net_amount), 0) as net_total,
      COALESCE(SUM(CASE WHEN dp.payment_status = 'paid' THEN dp.net_amount ELSE 0 END), 0) as paid_total,
      COALESCE(SUM(CASE WHEN dp.payment_status = 'pending' THEN dp.net_amount ELSE 0 END), 0) as pending_total
    FROM public.deliveries d
    LEFT JOIN public.delivery_payments dp ON d.id = dp.delivery_id
    WHERE d.workshop_id = workshop_id_param
      AND (start_date IS NULL OR d.delivery_date >= start_date)
      AND (end_date IS NULL OR d.delivery_date <= end_date)
  )
  SELECT 
    delivery_count::INTEGER,
    pending_count::INTEGER,
    paid_count::INTEGER,
    gross_total,
    advance_total,
    net_total,
    paid_total,
    pending_total
  FROM delivery_stats;
$$;

-- Function to get detailed financial report
CREATE OR REPLACE FUNCTION public.get_financial_report(
  workshop_id_param UUID DEFAULT NULL,
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE(
  delivery_id UUID,
  tracking_number TEXT,
  workshop_name TEXT,
  order_number TEXT,
  delivery_date DATE,
  total_units INTEGER,
  billable_units INTEGER,
  gross_amount NUMERIC(10,2),
  advance_deduction NUMERIC(10,2),
  net_amount NUMERIC(10,2),
  payment_status TEXT,
  payment_date DATE,
  payment_method TEXT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    w.name as workshop_name,
    o.order_number,
    d.delivery_date,
    dp.total_units,
    dp.billable_units,
    dp.gross_amount,
    dp.advance_deduction,
    dp.net_amount,
    dp.payment_status,
    dp.payment_date,
    dp.payment_method
  FROM public.deliveries d
  JOIN public.workshops w ON d.workshop_id = w.id
  JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.delivery_payments dp ON d.id = dp.delivery_id
  WHERE (workshop_id_param IS NULL OR d.workshop_id = workshop_id_param)
    AND (start_date IS NULL OR d.delivery_date >= start_date)
    AND (end_date IS NULL OR d.delivery_date <= end_date)
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$$;