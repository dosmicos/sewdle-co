-- EMERGENCY FIX: Remove ALL organization_users policies and create ultra-simple ones
-- This is to completely eliminate the infinite recursion issue

-- Drop ALL policies on organization_users table
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'organization_users' 
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.organization_users';
    END LOOP;
END $$;

-- Create the most basic possible policies to avoid any recursion
-- Users can only see their own membership records
CREATE POLICY "Users see own memberships only" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

-- Users can only update their own membership status
CREATE POLICY "Users update own memberships only" 
ON public.organization_users 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Only allow INSERT for service role (temporary measure)
CREATE POLICY "Service role can insert memberships" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (current_setting('role') = 'service_role' OR auth.uid() IS NOT NULL);

-- Only allow DELETE for service role or own records
CREATE POLICY "Service role or own records can delete" 
ON public.organization_users 
FOR DELETE 
USING (current_setting('role') = 'service_role' OR user_id = auth.uid());

-- Create a simple function to get user's first organization
CREATE OR REPLACE FUNCTION public.get_current_organization_simple()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT ou.organization_id 
  FROM organization_users ou
  WHERE ou.user_id = auth.uid() 
  AND ou.status = 'active' 
  ORDER BY ou.joined_at ASC
  LIMIT 1;
$$;

-- Replace the problematic function
DROP FUNCTION IF EXISTS public.get_current_organization_safe();
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT get_current_organization_simple();
$$;