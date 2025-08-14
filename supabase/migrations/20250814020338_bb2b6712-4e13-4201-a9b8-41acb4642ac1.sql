-- Try an alternative approach - create a completely minimal view that doesn't use any functions
-- This will help us isolate if the issue is with specific functions

-- First, let's create a temporary simple view to test the linter
DROP VIEW IF EXISTS public.deliveries_stats CASCADE;

-- Create a minimal view without any function calls to test
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
WHERE TRUE;  -- Temporary simple condition to test if this resolves the linter issue

-- Grant permissions
GRANT SELECT ON public.deliveries_stats TO authenticated;

-- Add a notice for testing
COMMENT ON VIEW public.deliveries_stats IS 'Temporary simplified view to diagnose Security Definer View linter issue';