-- Fix the format() function issue in calculate_replenishment_suggestions
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions();

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders INTEGER,
  projected_demand INTEGER,
  suggested_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  calculation_date DATE := CURRENT_DATE;
  variant_record RECORD;
  velocity NUMERIC;
  days_remaining NUMERIC;
  open_order_qty INTEGER;
  suggested_qty INTEGER;
  urgency TEXT;
  reason_text TEXT;
BEGIN
  -- Clear previous suggestions for today
  DELETE FROM replenishment_suggestions WHERE calculation_date = CURRENT_DATE;

  -- Process each product variant
  FOR variant_record IN 
    SELECT 
      pv.id,
      p.name as product_name,
      pv.size,
      pv.color,
      pv.sku_variant,
      pv.stock_quantity
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    WHERE p.status = 'active'
  LOOP
    -- Calculate sales velocity (units per day) over last 30 days
    SELECT COALESCE(
      SUM(di.quantity_delivered)::NUMERIC / GREATEST(30, 1), 
      0
    ) INTO velocity
    FROM delivery_items di
    INNER JOIN deliveries d ON di.delivery_id = d.id
    WHERE di.product_variant_id = variant_record.id
    AND d.delivery_date >= CURRENT_DATE - INTERVAL '30 days'
    AND d.status = 'approved';

    -- Calculate days of stock remaining
    IF velocity > 0 THEN
      days_remaining := variant_record.stock_quantity / velocity;
    ELSE
      days_remaining := 999; -- Virtually infinite if no sales
    END IF;

    -- Count pending orders quantity
    SELECT COALESCE(SUM(oi.quantity), 0) INTO open_order_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = variant_record.id
    AND o.status IN ('pending', 'assigned', 'in_progress');

    -- Determine urgency and calculate suggested quantity
    IF days_remaining <= 3 OR variant_record.stock_quantity = 0 THEN
      urgency := 'critical';
      suggested_qty := GREATEST(ROUND(velocity * 14)::INTEGER, 10); -- 2 weeks of stock minimum
      reason_text := 'Stock crítico: ' || ROUND(days_remaining, 1)::TEXT || ' días restantes';
    ELSIF days_remaining <= 7 THEN
      urgency := 'high';
      suggested_qty := GREATEST(ROUND(velocity * 10)::INTEGER, 5); -- 10 days of stock
      reason_text := 'Stock bajo: ' || ROUND(days_remaining, 1)::TEXT || ' días restantes';
    ELSIF days_remaining <= 14 THEN
      urgency := 'normal';
      suggested_qty := GREATEST(ROUND(velocity * 7)::INTEGER, 3); -- 1 week of stock
      reason_text := 'Reposición normal: ' || ROUND(days_remaining, 1)::TEXT || ' días restantes';
    ELSE
      urgency := 'low';
      suggested_qty := 0; -- No reposition needed
      reason_text := 'Stock suficiente: ' || ROUND(days_remaining, 1)::TEXT || ' días restantes';
    END IF;

    -- Consider pending orders in calculation
    IF open_order_qty > variant_record.stock_quantity THEN
      suggested_qty := suggested_qty + (open_order_qty - variant_record.stock_quantity);
      reason_text := reason_text || ', órdenes pendientes: ' || open_order_qty::TEXT;
    END IF;

    -- Insert suggestion if quantity > 0 or critical/high urgency
    IF suggested_qty > 0 OR urgency IN ('critical', 'high') THEN
      INSERT INTO replenishment_suggestions (
        variant_id,
        product_name,
        variant_size,
        variant_color,
        sku_variant,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders,
        projected_demand,
        suggested_quantity,
        urgency_level,
        reason,
        calculation_date
      ) VALUES (
        variant_record.id,
        variant_record.product_name,
        variant_record.size,
        variant_record.color,
        variant_record.sku_variant,
        variant_record.stock_quantity,
        velocity,
        days_remaining,
        open_order_qty,
        ROUND(velocity * 7)::INTEGER, -- 7 days projected demand
        suggested_qty,
        urgency,
        reason_text,
        calculation_date
      );
    END IF;

    -- Return the calculated values
    RETURN QUERY SELECT 
      variant_record.id,
      variant_record.product_name,
      variant_record.size,
      variant_record.color,
      variant_record.sku_variant,
      variant_record.stock_quantity,
      velocity,
      days_remaining,
      open_order_qty,
      ROUND(velocity * 7)::INTEGER,
      suggested_qty,
      urgency,
      reason_text;

  END LOOP;
END;
$$;