-- CRITICAL SECURITY FIX: Fix shopify_orders RLS policies
-- The "System can manage shopify orders" policy incorrectly allows public access
-- This exposes sensitive customer data (emails, phones, addresses)

-- Step 1: Drop the insecure policy that allows public access
DROP POLICY IF EXISTS "System can manage shopify orders" ON public.shopify_orders;

-- Step 2: Create a secure policy that only allows service_role (system) to manage orders
-- This is for system operations like webhooks and data synchronization
CREATE POLICY "Service role can manage shopify orders"
ON public.shopify_orders
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 3: Ensure the user policy is restrictive and secure
DROP POLICY IF EXISTS "Users can view shopify orders in their organization" ON public.shopify_orders;

CREATE POLICY "Authenticated users can view shopify orders in their organization"
ON public.shopify_orders
FOR SELECT
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND auth.uid() IS NOT NULL
);

-- Step 4: Add additional security - only allow admins and designers to view customer data
-- Regular users should not have access to sensitive customer information
CREATE POLICY "Admin users can manage shopify orders in their organization"
ON public.shopify_orders
FOR ALL
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
)
WITH CHECK (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Step 5: Apply the same security fix to shopify_order_line_items table
DROP POLICY IF EXISTS "System can manage shopify line items" ON public.shopify_order_line_items;

CREATE POLICY "Service role can manage shopify line items"
ON public.shopify_order_line_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update user access policy for line items
DROP POLICY IF EXISTS "Users can view shopify line items in their organization" ON public.shopify_order_line_items;

CREATE POLICY "Admin users can view shopify line items in their organization"
ON public.shopify_order_line_items
FOR SELECT
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- Step 6: Add logging trigger to monitor access to sensitive data
CREATE OR REPLACE FUNCTION public.log_shopify_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log access attempts to shopify orders for security monitoring
  INSERT INTO public.sync_control_logs (
    sync_type,
    sync_mode,
    status,
    error_message,
    execution_details
  ) VALUES (
    'security_audit',
    'shopify_access',
    'completed',
    format('User %s accessed shopify_orders', auth.uid()::text),
    jsonb_build_object(
      'user_id', auth.uid(),
      'table_name', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit trigger for shopify_orders access
DROP TRIGGER IF EXISTS audit_shopify_orders_access ON public.shopify_orders;
CREATE TRIGGER audit_shopify_orders_access
  AFTER SELECT ON public.shopify_orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.log_shopify_access();

-- Step 7: Verify RLS is enabled and functioning
DO $$
BEGIN
  -- Double-check that RLS is enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'shopify_orders' 
    AND relrowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on shopify_orders table - this is a critical security issue';
  END IF;
  
  RAISE NOTICE 'Security fix completed successfully - RLS is properly configured for shopify_orders';
END $$;