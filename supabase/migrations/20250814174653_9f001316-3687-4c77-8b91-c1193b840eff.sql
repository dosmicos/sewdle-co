-- Fix customer PII security issue in shopify_orders table
-- Remove the overly permissive policy that allows all authenticated users to view customer data
DROP POLICY IF EXISTS "Authenticated users can view shopify orders in their organizati" ON public.shopify_orders;

-- Only allow admins and designers to view full customer data
-- Use the existing organization checking approach
CREATE POLICY "Only admins and designers can view shopify orders with customer data" 
ON public.shopify_orders 
FOR SELECT 
USING (
  (EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() 
    AND ou.organization_id = shopify_orders.organization_id
    AND ou.status = 'active'
  ))
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
    )
  )
);

-- Create a function to get sanitized order data for non-privileged users
CREATE OR REPLACE FUNCTION public.get_shopify_orders_sanitized()
RETURNS TABLE(
  id uuid,
  shopify_order_id bigint,
  order_number text,
  organization_id uuid,
  financial_status text,
  fulfillment_status text,
  total_price numeric,
  currency text,
  created_at_shopify timestamp with time zone,
  updated_at_shopify timestamp with time zone,
  customer_email_masked text,
  customer_name_masked text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT 
    so.id,
    so.shopify_order_id,
    so.order_number,
    so.organization_id,
    so.financial_status,
    so.fulfillment_status,
    so.total_price,
    so.currency,
    so.created_at_shopify,
    so.updated_at_shopify,
    -- Always mask customer data for this function
    CONCAT('****@', SPLIT_PART(so.customer_email, '@', 2)) as customer_email_masked,
    CONCAT(LEFT(COALESCE(so.customer_first_name, ''), 1), '*** ', LEFT(COALESCE(so.customer_last_name, ''), 1), '***') as customer_name_masked
  FROM public.shopify_orders so
  WHERE EXISTS (
    SELECT 1 FROM public.organization_users ou
    WHERE ou.user_id = auth.uid() 
    AND ou.organization_id = so.organization_id
    AND ou.status = 'active'
  )
  AND auth.uid() IS NOT NULL
  ORDER BY so.created_at_shopify DESC;
$function$;

-- Update the customer analytics function to only work for admins and designers
DROP FUNCTION IF EXISTS public.get_customer_analytics(date, date);
CREATE OR REPLACE FUNCTION public.get_customer_analytics(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(customer_email text, customer_name text, orders_count bigint, total_spent numeric, avg_order_value numeric, first_order_date timestamp with time zone, last_order_date timestamp with time zone, customer_segment text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  -- Only return data for admins and designers
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
    AND EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.user_id = auth.uid() 
      AND ou.organization_id = so.organization_id
      AND ou.status = 'active'
    )
    -- Only allow admins and designers to access this function
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
    )
  GROUP BY so.customer_email, so.customer_first_name, so.customer_last_name
  HAVING COUNT(so.id) > 0
  ORDER BY total_spent DESC;
$function$;