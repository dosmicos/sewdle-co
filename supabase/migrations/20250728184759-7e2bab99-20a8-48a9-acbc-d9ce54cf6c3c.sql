-- Update calculate_replenishment_suggestions to use real Shopify data
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
 RETURNS TABLE(variant_id uuid, product_name text, variant_size text, variant_color text, sku_variant text, current_stock integer, sales_velocity numeric, days_of_stock numeric, open_orders integer, projected_demand integer, suggested_quantity integer, urgency_level text, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  variant_record RECORD;
  velocity NUMERIC;
  days_remaining NUMERIC;
  open_order_qty INTEGER;
  suggested_qty INTEGER;
  urgency TEXT;
  reason_text TEXT;
BEGIN
  -- Clear previous suggestions for today
  DELETE FROM replenishment_suggestions WHERE replenishment_suggestions.calculation_date = CURRENT_DATE;

  -- Sync sales metrics first to ensure we have current data
  PERFORM sync_sales_metrics_from_shopify();

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
    -- Calculate sales velocity (units per day) over last 30 days from sales metrics
    SELECT COALESCE(
      AVG(sm.sales_quantity), 
      0
    ) INTO velocity
    FROM sales_metrics sm
    WHERE sm.product_variant_id = variant_record.id
    AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days';

    -- If no sales metrics, try to calculate from Shopify orders directly
    IF velocity = 0 THEN
      SELECT COALESCE(
        SUM(soli.quantity)::NUMERIC / GREATEST(30, 1), 
        0
      ) INTO velocity
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = variant_record.sku_variant
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'pending');
    END IF;

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

    -- Add velocity information to reason
    IF velocity > 0 THEN
      reason_text := reason_text || ', vel. venta: ' || ROUND(velocity, 2)::TEXT || '/día';
    ELSE
      reason_text := reason_text || ', sin ventas recientes';
    END IF;

    -- Insert suggestion if quantity > 0 or critical/high urgency
    IF suggested_qty > 0 OR urgency IN ('critical', 'high') THEN
      INSERT INTO replenishment_suggestions (
        product_variant_id,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        projected_demand,
        suggested_quantity,
        urgency_level,
        reason,
        calculation_date
      ) VALUES (
        variant_record.id,
        variant_record.stock_quantity,
        velocity,
        days_remaining,
        open_order_qty,
        ROUND(velocity * 7)::INTEGER, -- 7 days projected demand
        suggested_qty,
        urgency,
        reason_text,
        CURRENT_DATE
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
  
  RAISE NOTICE 'Replenishment suggestions calculated using real Shopify sales data';
END;
$function$;