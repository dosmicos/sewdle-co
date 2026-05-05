-- Fix customer PII security issue in shopify_orders table
-- Remove the overly permissive policy that allows all authenticated users to view customer data
DROP POLICY IF EXISTS "Authenticated users can view shopify orders in their organizati" ON public.shopify_orders;

-- Create a view for sanitized order data without customer PII
CREATE OR REPLACE VIEW public.shopify_orders_summary AS
SELECT 
  id,
  shopify_order_id,
  order_number,
  organization_id,
  financial_status,
  fulfillment_status,
  total_price,
  currency,
  created_at_shopify,
  updated_at_shopify,
  synced_at,
  created_at,
  updated_at,
  -- Mask customer data for non-privileged users
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN customer_email 
    ELSE CONCAT('****@', SPLIT_PART(customer_email, '@', 2))
  END as customer_email,
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN customer_first_name 
    ELSE LEFT(customer_first_name, 1) || '***'
  END as customer_first_name,
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN customer_last_name 
    ELSE LEFT(customer_last_name, 1) || '***'
  END as customer_last_name,
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN customer_phone 
    ELSE '***-***-' || RIGHT(customer_phone, 4)
  END as customer_phone,
  -- Remove sensitive address data for non-privileged users
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN billing_address 
    ELSE NULL
  END as billing_address,
  CASE 
    WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
    THEN shipping_address 
    ELSE NULL
  END as shipping_address
FROM public.shopify_orders
WHERE organization_id = get_current_organization();

-- Grant access to the view for authenticated users
GRANT SELECT ON public.shopify_orders_summary TO authenticated;

-- Update the customer analytics function to ensure it respects role permissions
CREATE OR REPLACE FUNCTION public.get_customer_analytics_secure(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(customer_email text, customer_name text, orders_count bigint, total_spent numeric, avg_order_value numeric, first_order_date timestamp with time zone, last_order_date timestamp with time zone, customer_segment text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Only allow admins and designers to access detailed customer analytics
  SELECT 
    CASE 
      WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
      THEN so.customer_email 
      ELSE CONCAT('****@', SPLIT_PART(so.customer_email, '@', 2))
    END as customer_email,
    CASE 
      WHEN get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]) 
      THEN CONCAT(COALESCE(so.customer_first_name, ''), ' ', COALESCE(so.customer_last_name, ''))
      ELSE CONCAT(LEFT(COALESCE(so.customer_first_name, ''), 1), '*** ', LEFT(COALESCE(so.customer_last_name, ''), 1), '***')
    END as customer_name,
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
    AND so.organization_id = get_current_organization()
    AND (
      get_current_user_role() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
      OR auth.uid() IS NOT NULL  -- Allow access but with masked data
    )
  GROUP BY so.customer_email, so.customer_first_name, so.customer_last_name
  HAVING COUNT(so.id) > 0
  ORDER BY total_spent DESC;
$function$;