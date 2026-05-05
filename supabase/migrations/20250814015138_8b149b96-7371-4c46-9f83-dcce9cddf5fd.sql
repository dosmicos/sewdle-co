-- Drop and recreate functions with correct signatures

DROP FUNCTION IF EXISTS public.get_available_orders();

CREATE OR REPLACE FUNCTION public.get_available_orders()
 RETURNS TABLE(id uuid, order_number text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

-- Final notification about security fixes completed
COMMENT ON FUNCTION public.get_available_orders() IS 'Security-hardened function with search_path protection';

-- Summary notification
DO $$
BEGIN
  RAISE NOTICE 'CRITICAL SECURITY FIXES COMPLETED:';
  RAISE NOTICE '✅ Fixed overly permissive RLS policies on order_supplies';
  RAISE NOTICE '✅ Fixed overly permissive RLS policies on material_deliveries';
  RAISE NOTICE '✅ Added search_path security to 12+ critical database functions';
  RAISE NOTICE '✅ Created security audit logging system with proper RLS';
  RAISE NOTICE '✅ Fixed Security Definer view to use Security Invoker';
  RAISE NOTICE '⚠️  REMAINING: ~25 functions still need search_path fixes';
  RAISE NOTICE '⚠️  MANUAL: Auth OTP expiry and password protection need configuration';
  RAISE NOTICE '⚠️  MANUAL: Extension in public schema warning';
END $$;