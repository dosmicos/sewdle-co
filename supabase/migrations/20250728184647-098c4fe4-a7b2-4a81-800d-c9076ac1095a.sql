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
  loop_date date;
  sales_record RECORD;
BEGIN
  -- Delete existing metrics for the period to avoid duplicates
  DELETE FROM public.sales_metrics 
  WHERE metric_date >= start_date AND metric_date <= end_date;
  
  -- Loop through each day in the period
  loop_date := start_date;
  WHILE loop_date <= end_date LOOP
    
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
      WHERE DATE(so.created_at_shopify) = loop_date
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
        loop_date,
        sales_record.daily_quantity,
        sales_record.daily_orders,
        sales_record.avg_order_size
      );
    END LOOP;
    
    loop_date := loop_date + INTERVAL '1 day';
  END LOOP;
  
  RAISE NOTICE 'Sales metrics synced from % to %', start_date, end_date;
END;
$function$;