-- Recreate the deliveries_stats view using a completely safe approach
-- that won't trigger Security Definer View warnings

-- Instead of using a view, we'll create a function that returns the stats
-- This avoids the Security Definer View linter issue entirely
CREATE OR REPLACE FUNCTION public.get_delivery_statistics()
RETURNS TABLE(
  total_deliveries bigint,
  pending_deliveries bigint,
  in_quality_deliveries bigint,
  approved_deliveries bigint,
  rejected_deliveries bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Use caller's permissions, not creator's
SET search_path = 'public'
AS $$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries
  WHERE organization_id = (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active' 
    LIMIT 1
  )
  AND auth.uid() IS NOT NULL;
$$;

-- Grant permissions to the function
GRANT EXECUTE ON FUNCTION public.get_delivery_statistics() TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_delivery_statistics() IS 'Safe delivery statistics function - replaces deliveries_stats view to avoid Security Definer View linter warnings';