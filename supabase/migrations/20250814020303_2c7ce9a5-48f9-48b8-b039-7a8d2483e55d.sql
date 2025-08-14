-- Fix the deliveries_stats view by ensuring it uses the correct SECURITY INVOKER function
-- and not any SECURITY DEFINER functions

-- Drop and recreate the view with the correct function call
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
WHERE organization_id = public.get_current_organization_for_views()
AND auth.uid() IS NOT NULL;

-- Grant permissions
GRANT SELECT ON public.deliveries_stats TO authenticated;

-- Verify the view definition no longer references SECURITY DEFINER functions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_views v
    CROSS JOIN pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE v.schemaname = 'public'
    AND v.viewname = 'deliveries_stats'
    AND n.nspname = 'public'
    AND p.prosecdef = true
    AND v.definition LIKE '%' || p.proname || '%'
  ) THEN
    RAISE WARNING 'deliveries_stats view still references SECURITY DEFINER functions';
  ELSE
    RAISE NOTICE '✅ deliveries_stats view successfully fixed - no longer references SECURITY DEFINER functions';
  END IF;
END $$;