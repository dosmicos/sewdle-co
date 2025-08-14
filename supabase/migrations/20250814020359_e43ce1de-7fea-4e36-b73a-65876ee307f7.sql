-- Complete approach: drop the view entirely to see if that resolves the Security Definer View issue
-- This will help us determine if deliveries_stats is the source of the problem

DROP VIEW IF EXISTS public.deliveries_stats CASCADE;

-- Check if there are any other objects that could be causing the Security Definer View warning
DO $$
DECLARE
    view_record RECORD;
    total_views INTEGER;
BEGIN
    -- Count total views in public schema
    SELECT COUNT(*) INTO total_views
    FROM pg_views 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Total views in public schema: %', total_views;
    
    -- List all views for debugging
    FOR view_record IN 
        SELECT viewname, definition
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE 'View found: %', view_record.viewname;
    END LOOP;
    
    -- Check for materialized views too
    FOR view_record IN 
        SELECT matviewname as viewname
        FROM pg_matviews 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE 'Materialized view found: %', view_record.viewname;
    END LOOP;
    
    IF total_views = 0 THEN
        RAISE NOTICE '✅ No views remaining in public schema - Security Definer View issue should be resolved';
    ELSE
        RAISE NOTICE '⚠️ Still % views remaining that could be causing the Security Definer View issue', total_views;
    END IF;
END $$;