-- SIMPLE FIX: Replace just the organization_users policies with ultra-simple ones
-- Keep the function but make policies non-recursive

-- Drop ALL policies on organization_users table only
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

-- Replace the function to be completely non-recursive
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Direct query without any policy dependencies
    SELECT organization_id INTO org_id
    FROM organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active' 
    LIMIT 1;
    
    RETURN org_id;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

-- Create ultra-simple policies that don't cause recursion
CREATE POLICY "Users see own records" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

-- Allow updates only for own records
CREATE POLICY "Users update own records" 
ON public.organization_users 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow inserts (for registration)
CREATE POLICY "Allow inserts" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow deletes for own records
CREATE POLICY "Users delete own records" 
ON public.organization_users 
FOR DELETE 
USING (user_id = auth.uid());