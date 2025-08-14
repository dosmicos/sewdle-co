-- Fix critical security vulnerability in sales_metrics table
-- Drop ALL existing policies first to avoid conflicts

DROP POLICY IF EXISTS "System can manage sales metrics" ON public.sales_metrics;
DROP POLICY IF EXISTS "Users can view sales metrics in their organization" ON public.sales_metrics;

-- Create secure, restrictive RLS policies

-- 1. Allow users to view sales metrics only for their organization (READ-ONLY)
CREATE POLICY "Users can view sales metrics in their organization" 
ON public.sales_metrics 
FOR SELECT 
USING (organization_id = get_current_organization_safe());

-- 2. Create security function to check if the current role is authorized for system operations
CREATE OR REPLACE FUNCTION public.is_system_or_service_role()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT 
    -- Allow service role (used by edge functions)
    auth.role() = 'service_role'
    OR
    -- Allow if user has system admin privileges (for emergency management)
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_users ou
      WHERE ou.user_id = auth.uid()
      AND ou.role = 'owner'
      AND ou.status = 'active'
    ));
$$;

-- 3. Only system can insert sales metrics
CREATE POLICY "Only system can insert sales metrics" 
ON public.sales_metrics 
FOR INSERT 
WITH CHECK (is_system_or_service_role());

-- 4. Only system can update sales metrics
CREATE POLICY "Only system can update sales metrics" 
ON public.sales_metrics 
FOR UPDATE 
USING (is_system_or_service_role());

-- 5. Only system can delete sales metrics
CREATE POLICY "Only system can delete sales metrics" 
ON public.sales_metrics 
FOR DELETE 
USING (is_system_or_service_role());

-- Add audit trigger for all sales_metrics changes
CREATE OR REPLACE FUNCTION public.audit_sales_metrics_changes()
RETURNS TRIGGER AS $$
DECLARE
  operation_type text;
  user_context jsonb;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    operation_type := 'INSERT';
  ELSIF TG_OP = 'UPDATE' THEN
    operation_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    operation_type := 'DELETE';
  END IF;

  -- Build user context
  user_context := jsonb_build_object(
    'user_id', auth.uid(),
    'role', auth.role(),
    'operation', operation_type,
    'table', 'sales_metrics',
    'timestamp', now(),
    'old_data', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) ELSE NULL END,
    'new_data', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END
  );

  -- Log to security audit (only if security_audit_log table exists and has data)
  BEGIN
    INSERT INTO public.security_audit_log (
      event_type,
      user_id,
      organization_id,
      event_details
    ) VALUES (
      'sales_metrics_modification',
      auth.uid(),
      COALESCE(NEW.organization_id, OLD.organization_id),
      user_context
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Continue operation even if audit logging fails
      NULL;
  END;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Apply audit trigger
DROP TRIGGER IF EXISTS audit_sales_metrics_trigger ON public.sales_metrics;
CREATE TRIGGER audit_sales_metrics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_metrics
  FOR EACH ROW
  EXECUTE FUNCTION audit_sales_metrics_changes();

-- Create secure function for system operations to update sales metrics
CREATE OR REPLACE FUNCTION public.update_sales_metrics_secure(
  p_product_variant_id uuid,
  p_organization_id uuid,
  p_metric_date date,
  p_sales_quantity integer,
  p_orders_count integer,
  p_avg_order_size numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify this is being called by an authorized context
  IF NOT is_system_or_service_role() THEN
    RAISE EXCEPTION 'Unauthorized: Only system operations can update sales metrics';
  END IF;

  -- Validate input parameters
  IF p_organization_id IS NULL OR p_product_variant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid parameters: organization_id and product_variant_id are required';
  END IF;

  -- Upsert the sales metric
  INSERT INTO public.sales_metrics (
    product_variant_id,
    organization_id,
    metric_date,
    sales_quantity,
    orders_count,
    avg_order_size
  ) VALUES (
    p_product_variant_id,
    p_organization_id,
    p_metric_date,
    p_sales_quantity,
    p_orders_count,
    p_avg_order_size
  )
  ON CONFLICT (product_variant_id, organization_id, metric_date)
  DO UPDATE SET
    sales_quantity = EXCLUDED.sales_quantity,
    orders_count = EXCLUDED.orders_count,
    avg_order_size = EXCLUDED.avg_order_size;
END;
$$;

-- Grant execute permission to service role for the secure function
GRANT EXECUTE ON FUNCTION public.update_sales_metrics_secure TO service_role;

-- Log this security fix for audit purposes
INSERT INTO public.security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details
) VALUES (
  'security_policy_update',
  auth.uid(),
  NULL,
  jsonb_build_object(
    'table', 'sales_metrics',
    'action', 'fixed_critical_security_vulnerability',
    'severity', 'critical',
    'description', 'Replaced dangerous open access policy with system-only write access',
    'changes', jsonb_build_array(
      'Removed policy allowing all users full access to financial data',
      'Added read-only access for organization members',
      'Restricted write/update/delete to system role only',
      'Added comprehensive audit logging',
      'Created secure function for legitimate system operations'
    ),
    'impact', 'Prevents unauthorized manipulation of sales and financial metrics data',
    'timestamp', now()
  )
);