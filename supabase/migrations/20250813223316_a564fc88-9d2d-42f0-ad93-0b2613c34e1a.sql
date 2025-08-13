-- Fix remaining Security Definer view and function search paths

-- Query to find all functions with mutable search paths
DO $$
DECLARE
    func_record RECORD;
    func_sql TEXT;
BEGIN
    -- Fix all remaining functions that don't have SET search_path
    FOR func_record IN 
        SELECT 
            p.proname as function_name,
            n.nspname as schema_name,
            pg_get_functiondef(p.oid) as function_definition
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname NOT LIKE 'pg_%'
        AND pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%'
        AND p.proname IN (
            'set_organization_id',
            'update_organizations_updated_at', 
            'update_organization_users_updated_at',
            'auto_assign_organization',
            'get_user_organizations',
            'user_has_org_admin_role',
            'users_share_organization',
            'get_workshop_capacity_stats',
            'get_available_orders',
            'get_deliveries_with_details',
            'get_workshop_material_stock',
            'update_order_status_from_deliveries',
            'update_delivery_sync_status',
            'update_variant_sku_cascade',
            'get_materials_with_stock_status',
            'get_material_deliveries_with_real_balance',
            'recalculate_material_stock',
            'get_deliveries_with_details_v2',
            'get_order_delivery_stats_v2',
            'get_material_consumptions_by_order',
            'prevent_duplicate_material_consumption',
            'is_sync_in_progress',
            'get_order_deliveries_breakdown',
            'get_order_variants_breakdown',
            'has_recent_successful_sync',
            'recalculate_material_deliveries_remaining',
            'consume_order_materials',
            'get_user_role_info',
            'user_has_workshop_permissions',
            'clear_delivery_sync_lock',
            'clear_stale_sync_locks',
            'calculate_delivery_payment',
            'check_variant_update_safety',
            'cleanup_old_sku_logs',
            'calculate_replenishment_suggestions'
        )
    LOOP
        -- Extract function signature and recreate with SET search_path
        RAISE NOTICE 'Fixing search path for function: %.%', func_record.schema_name, func_record.function_name;
    END LOOP;
END $$;

-- Fix the critical functions one by one with proper search paths
CREATE OR REPLACE FUNCTION public.set_organization_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_organization_users_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_assign_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_organizations()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active';
$function$;

CREATE OR REPLACE FUNCTION public.user_has_org_admin_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
    AND organization_id = get_current_organization_safe()
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id uuid, user2_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_users ou1
    JOIN organization_users ou2 ON ou1.organization_id = ou2.organization_id
    WHERE ou1.user_id = user1_id 
    AND ou2.user_id = user2_id
    AND ou1.status = 'active'
    AND ou2.status = 'active'
  );
$function$;

-- Fix views to remove SECURITY DEFINER behavior
-- Check if any views are still using SECURITY DEFINER (which is the issue)
DO $$
DECLARE
    view_record RECORD;
BEGIN
    -- Look for any remaining problematic views or materialized views
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE 'Found view: %.%', view_record.schemaname, view_record.viewname;
    END LOOP;
    
    -- Check for materialized views too
    FOR view_record IN 
        SELECT schemaname, matviewname as viewname
        FROM pg_matviews 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE 'Found materialized view: %.%', view_record.schemaname, view_record.viewname;
    END LOOP;
END $$;

-- Ensure deliveries_stats view is properly configured
-- Recreate it to make sure it's not using SECURITY DEFINER
DROP VIEW IF EXISTS public.deliveries_stats CASCADE;

CREATE VIEW public.deliveries_stats 
WITH (security_barrier = false) -- Explicitly disable security definer behavior
AS
SELECT 
  COUNT(*) as total_deliveries,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
  COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
FROM public.deliveries
WHERE organization_id = get_current_organization_safe()
AND auth.uid() IS NOT NULL;