-- Corregir la función calculate_replenishment_suggestions() para arreglar los cálculos
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
  lead_time_days INTEGER := 20; -- Lead time de 20 días
  safety_days INTEGER := 7; -- Días de seguridad
  target_stock_days INTEGER;
BEGIN
  -- Clear previous suggestions for today
  DELETE FROM replenishment_suggestions WHERE replenishment_suggestions.calculation_date = CURRENT_DATE;

  -- Sync sales metrics first to ensure we have current data
  PERFORM sync_sales_metrics_from_shopify();

  target_stock_days := lead_time_days + safety_days; -- 27 días total

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
    -- CORREGIDO: usar SUM en lugar de AVG
    SELECT COALESCE(
      SUM(sm.sales_quantity) / 30.0, 
      0
    ) INTO velocity
    FROM sales_metrics sm
    WHERE sm.product_variant_id = variant_record.id
    AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days';

    -- If no sales metrics, try to calculate from Shopify orders directly
    -- CORREGIDO: usar SUM dividido por 30 en lugar de promedio
    IF velocity = 0 THEN
      SELECT COALESCE(
        SUM(soli.quantity)::NUMERIC / 30.0, 
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

    -- CORREGIDO: Count pending orders quantity correctly - subtract delivered quantities
    SELECT COALESCE(SUM(
      oi.quantity - COALESCE(delivered_approved.total_approved, 0)
    ), 0) INTO open_order_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    LEFT JOIN (
      SELECT 
        di.order_item_id,
        SUM(COALESCE(di.quantity_approved, 0)) as total_approved
      FROM delivery_items di
      JOIN deliveries d ON di.delivery_id = d.id
      WHERE d.status IN ('approved', 'partial_approved')
      GROUP BY di.order_item_id
    ) delivered_approved ON oi.id = delivered_approved.order_item_id
    WHERE oi.product_variant_id = variant_record.id
    AND o.status IN ('pending', 'assigned', 'in_progress')
    AND (oi.quantity - COALESCE(delivered_approved.total_approved, 0)) > 0;

    -- CORREGIDO: Calculate suggested quantity considering lead time and actual pending production
    -- Stock objetivo = velocidad × días objetivo (27 días)
    -- Cantidad sugerida = MAX(0, stock_objetivo - stock_actual - producción_pendiente)
    IF velocity > 0 THEN
      suggested_qty := GREATEST(0, 
        ROUND(velocity * target_stock_days)::INTEGER - 
        variant_record.stock_quantity - 
        open_order_qty
      );
    ELSE
      suggested_qty := 0;
    END IF;

    -- CORREGIDO: Determine urgency considering lead time
    IF days_remaining <= 7 OR variant_record.stock_quantity = 0 THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= 14 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= target_stock_days THEN
      urgency := 'normal';
      reason_text := format('Reposición normal: %.1f días restantes (objetivo %s días)', days_remaining, target_stock_days);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %.1f días restantes', days_remaining);
    END IF;

    -- CORREGIDO: Add detailed information to reason
    reason_text := reason_text || format(', vel. venta: %.3f/día', velocity);
    
    IF open_order_qty > 0 THEN
      reason_text := reason_text || format(', pendiente producción: %s units', open_order_qty);
    END IF;
    
    IF suggested_qty > 0 THEN
      reason_text := reason_text || format(', stock objetivo: %.1f units', velocity * target_stock_days);
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
        ROUND(velocity * target_stock_days)::INTEGER, -- Projected demand for target period
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
      ROUND(velocity * target_stock_days)::INTEGER,
      suggested_qty,
      urgency,
      reason_text;

  END LOOP;
  
  RAISE NOTICE 'Replenishment suggestions calculated with corrected formulas (lead time: % days, safety: % days)', lead_time_days, safety_days;
END;
$function$;