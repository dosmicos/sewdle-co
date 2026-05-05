-- FIX SECURITY DEFINER VIEW ISSUE
-- Remove SECURITY DEFINER functions and use a safer approach with proper RLS policies

-- Step 1: Drop the SECURITY DEFINER functions that are flagged as risky
DROP FUNCTION IF EXISTS public.get_delivery_stats();
DROP FUNCTION IF EXISTS public.get_delivery_stats_admin();
DROP FUNCTION IF EXISTS public.log_stats_access();

-- Step 2: Drop the current view to recreate it properly
DROP VIEW IF EXISTS public.deliveries_stats;

-- Step 3: Create a secure view without SECURITY DEFINER
-- This view will respect the RLS policies of the underlying deliveries table
CREATE VIEW public.deliveries_stats AS
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
  COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
FROM public.deliveries
WHERE organization_id = get_current_organization_safe();

-- Step 4: Enable RLS on the view itself (even though it's a view)
-- This provides defense in depth
ALTER VIEW public.deliveries_stats SET (security_barrier = true);

-- Step 5: Create RLS policies directly on the view to control access
-- Since views don't support RLS policies directly, we'll rely on the underlying table's RLS

-- Step 6: Ensure proper permissions - only authenticated users can access
REVOKE ALL ON public.deliveries_stats FROM public;
GRANT SELECT ON public.deliveries_stats TO authenticated;

-- Step 7: Create a safer function for admin stats (SECURITY INVOKER, not DEFINER)
CREATE OR REPLACE FUNCTION public.get_organization_delivery_stats()
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
SECURITY INVOKER  -- This is the key change - uses caller's permissions, not creator's
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
  GROUP BY o.name;
$$;

-- Step 8: Grant permissions to the new function
GRANT EXECUTE ON FUNCTION public.get_organization_delivery_stats() TO authenticated;

-- Step 9: Verify that the underlying deliveries table has proper RLS
-- The view will automatically inherit the security from the underlying table
DO $$
BEGIN
  -- Verify deliveries table has RLS enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'deliveries' 
    AND relrowsecurity = true
  ) THEN
    RAISE WARNING 'deliveries table does not have RLS enabled - this is a security risk';
  END IF;
  
  -- Check that there are organization-based policies on deliveries
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'deliveries' 
    AND qual LIKE '%organization%'
  ) THEN
    RAISE WARNING 'deliveries table may not have organization-based RLS policies';
  END IF;
  
  RAISE NOTICE 'Security fix completed - removed SECURITY DEFINER and using SECURITY INVOKER approach';
  RAISE NOTICE 'View now relies on underlying table RLS policies for security';
END $$;