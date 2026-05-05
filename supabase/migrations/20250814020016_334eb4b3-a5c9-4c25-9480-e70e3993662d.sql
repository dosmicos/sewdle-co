-- Fix the Security Definer View issue by creating a view-safe organization function
-- and updating the deliveries_stats view to use it

-- Create a SECURITY INVOKER version of the organization function for use in views
CREATE OR REPLACE FUNCTION public.get_current_organization_for_views()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY INVOKER  -- This is key - uses caller's permissions, not creator's
 SET search_path = 'public'
AS $function$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$function$;

-- Drop and recreate the deliveries_stats view to use the new function
DROP VIEW IF EXISTS public.deliveries_stats CASCADE;

CREATE VIEW public.deliveries_stats 
WITH (security_barrier = false)
AS
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
  COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
FROM public.deliveries
WHERE organization_id = get_current_organization_for_views()
AND auth.uid() IS NOT NULL;

-- Grant permissions to the new function and view
GRANT EXECUTE ON FUNCTION public.get_current_organization_for_views() TO authenticated;
GRANT SELECT ON public.deliveries_stats TO authenticated;

-- Add comment to document the security fix
COMMENT ON FUNCTION public.get_current_organization_for_views() IS 'SECURITY INVOKER version for use in views to avoid Security Definer View warnings';
COMMENT ON VIEW public.deliveries_stats IS 'Secure view using SECURITY INVOKER function to avoid linter warnings';