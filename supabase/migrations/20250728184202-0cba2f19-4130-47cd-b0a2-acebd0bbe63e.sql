-- Fix get_customer_analytics to work with actual Shopify data
CREATE OR REPLACE FUNCTION public.get_customer_analytics(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(customer_email text, customer_name text, orders_count bigint, total_spent numeric, avg_order_value numeric, first_order_date timestamp with time zone, last_order_date timestamp with time zone, customer_segment text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    so.customer_email,
    CONCAT(COALESCE(so.customer_first_name, ''), ' ', COALESCE(so.customer_last_name, '')) as customer_name,
    COUNT(so.id) as orders_count,
    SUM(so.total_price) as total_spent,
    AVG(so.total_price) as avg_order_value,
    MIN(so.created_at_shopify) as first_order_date,
    MAX(so.created_at_shopify) as last_order_date,
    CASE 
      WHEN COUNT(so.id) >= 5 THEN 'VIP'
      WHEN COUNT(so.id) >= 3 THEN 'Regular' 
      WHEN COUNT(so.id) >= 2 THEN 'Repeat'
      ELSE 'New'
    END as customer_segment
  FROM public.shopify_orders so
  WHERE so.created_at_shopify >= start_date 
    AND so.created_at_shopify <= end_date + INTERVAL '1 day'
    AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    AND so.customer_email IS NOT NULL
    AND so.customer_email != ''
  GROUP BY so.customer_email, so.customer_first_name, so.customer_last_name
  HAVING COUNT(so.id) > 0
  ORDER BY total_spent DESC;
$function$;

-- Fix get_product_sales_analytics to work with actual Shopify data
CREATE OR REPLACE FUNCTION public.get_product_sales_analytics(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(sku text, product_title text, variant_title text, total_quantity bigint, total_revenue numeric, avg_price numeric, orders_count bigint, customers_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    soli.sku,
    soli.title as product_title,
    COALESCE(soli.variant_title, 'Default') as variant_title,
    SUM(soli.quantity) as total_quantity,
    SUM(soli.price * soli.quantity) as total_revenue,
    AVG(soli.price) as avg_price,
    COUNT(DISTINCT so.shopify_order_id) as orders_count,
    COUNT(DISTINCT so.customer_email) as customers_count
  FROM public.shopify_order_line_items soli
  JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
  WHERE so.created_at_shopify >= start_date 
    AND so.created_at_shopify <= end_date + INTERVAL '1 day'
    AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    AND soli.sku IS NOT NULL
    AND soli.sku != ''
  GROUP BY soli.sku, soli.title, soli.variant_title
  HAVING SUM(soli.quantity) > 0
  ORDER BY total_revenue DESC;
$function$;

-- Create function to sync sales metrics from Shopify data
CREATE OR REPLACE FUNCTION public.sync_sales_metrics_from_shopify()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  start_date date := CURRENT_DATE - INTERVAL '90 days';
  end_date date := CURRENT_DATE;
  current_date date;
  sales_record RECORD;
BEGIN
  -- Delete existing metrics for the period to avoid duplicates
  DELETE FROM public.sales_metrics 
  WHERE metric_date >= start_date AND metric_date <= end_date;
  
  -- Loop through each day in the period
  current_date := start_date;
  WHILE current_date <= end_date LOOP
    
    -- Calculate daily sales metrics for each product variant
    FOR sales_record IN
      SELECT 
        pv.id as product_variant_id,
        SUM(soli.quantity)::integer as daily_quantity,
        COUNT(DISTINCT so.shopify_order_id)::integer as daily_orders,
        CASE 
          WHEN COUNT(DISTINCT so.shopify_order_id) > 0 
          THEN (SUM(soli.quantity)::numeric / COUNT(DISTINCT so.shopify_order_id))
          ELSE 0 
        END as avg_order_size
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      LEFT JOIN public.product_variants pv ON soli.sku = pv.sku_variant
      WHERE DATE(so.created_at_shopify) = current_date
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
        AND soli.sku IS NOT NULL
        AND pv.id IS NOT NULL
      GROUP BY pv.id
      HAVING SUM(soli.quantity) > 0
    LOOP
      -- Insert the daily metrics
      INSERT INTO public.sales_metrics (
        product_variant_id,
        metric_date,
        sales_quantity,
        orders_count,
        avg_order_size
      ) VALUES (
        sales_record.product_variant_id,
        current_date,
        sales_record.daily_quantity,
        sales_record.daily_orders,
        sales_record.avg_order_size
      );
    END LOOP;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  RAISE NOTICE 'Sales metrics synced from % to %', start_date, end_date;
END;
$function$;

-- Update calculate_replenishment_suggestions to use real Shopify data
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
 RETURNS TABLE(variant_id uuid, product_name text, variant_size text, variant_color text, sku_variant text, current_stock integer, sales_velocity numeric, days_of_stock numeric, open_orders integer, projected_demand integer, suggested_quantity integer, urgency_level text, reason text)
 LANGUAGE plpgsql
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