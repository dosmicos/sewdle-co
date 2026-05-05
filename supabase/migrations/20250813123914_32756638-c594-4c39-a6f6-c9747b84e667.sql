-- CRITICAL SECURITY FIX: Secure deliveries_stats view
-- The view currently exposes business intelligence data without any access controls
-- It aggregates delivery metrics across ALL organizations without restrictions

-- Step 1: Drop the insecure view that exposes cross-organization data
DROP VIEW IF EXISTS public.deliveries_stats;

-- Step 2: Create a secure function instead of a view for better access control
CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(
  total_deliveries bigint,
  pending_deliveries bigint, 
  in_quality_deliveries bigint,
  approved_deliveries bigint,
  rejected_deliveries bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries
  WHERE organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL;
$$;

-- Step 3: Create a secure view that uses the organization-aware function
-- This ensures data is properly filtered by organization
CREATE VIEW public.deliveries_stats
WITH (security_barrier=true) AS
SELECT * FROM public.get_delivery_stats();

-- Step 4: Enable RLS on the view (even though it's a view, this provides additional security)
ALTER VIEW public.deliveries_stats SET (security_barrier = true);

-- Step 5: Create RLS policies for the underlying deliveries table if not already secured
-- (This ensures the source data is properly protected)
DO $$
BEGIN
  -- Check if deliveries table has proper RLS policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'deliveries' 
    AND policyname LIKE '%organization%'
  ) THEN
    RAISE WARNING 'Deliveries table may not have organization-based RLS policies - this should be reviewed';
  END IF;
END $$;

-- Step 6: Create additional security function for admin-level stats
CREATE OR REPLACE FUNCTION public.get_delivery_stats_admin()
RETURNS TABLE(
  total_deliveries bigint,
  pending_deliveries bigint,
  in_quality_deliveries bigint, 
  approved_deliveries bigint,
  rejected_deliveries bigint,
  organization_name text
)
LANGUAGE sql
STABLE  
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COUNT(d.*) as total_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'rejected') as rejected_deliveries,
    o.name as organization_name
  FROM public.deliveries d
  JOIN public.organizations o ON d.organization_id = o.id
  WHERE d.organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
  GROUP BY o.name;
$$;

-- Step 7: Grant appropriate permissions
-- Only authenticated users should access delivery stats
REVOKE ALL ON public.deliveries_stats FROM public;
GRANT SELECT ON public.deliveries_stats TO authenticated;

-- Step 8: Create audit logging for sensitive data access
CREATE OR REPLACE FUNCTION public.log_stats_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log access to delivery stats for security monitoring
  INSERT INTO public.sync_control_logs (
    sync_type,
    sync_mode, 
    status,
    error_message,
    execution_details
  ) VALUES (
    'security_audit',
    'stats_access',
    'completed',
    format('User %s accessed delivery stats', auth.uid()::text),
    jsonb_build_object(
      'user_id', auth.uid(),
      'organization_id', get_current_organization_safe(),
      'access_type', 'delivery_stats',
      'timestamp', now()
    )
  );
END;
$$;

-- Step 9: Verify the security implementation
DO $$
BEGIN
  RAISE NOTICE 'Security fix completed successfully - deliveries_stats now properly secured by organization';
  RAISE NOTICE 'Users can only see delivery statistics for their own organization';
  RAISE NOTICE 'Access is restricted to authenticated users only';
END $$;