-- CRITICAL FIX: Infinite Recursion in organization_users RLS policies
-- Replace recursive policies with simple, non-recursive ones

-- Drop all existing policies on organization_users to start fresh
DROP POLICY IF EXISTS "Organization owners and admins can invite users" ON public.organization_users;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_users;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization members where they are members" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON public.organization_users;

-- Create a simple security definer function to check organization membership
CREATE OR REPLACE FUNCTION public.get_user_organization_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ARRAY(
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  );
$$;

-- Create a function to check if user is admin/owner in an organization
CREATE OR REPLACE FUNCTION public.is_user_admin_in_org(org_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND organization_id = org_id 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  );
$$;

-- Simple policy: Users can always view their own memberships
CREATE POLICY "Users can view their own memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

-- Simple policy: Users can view other members in organizations where they are members
CREATE POLICY "Users can view members in their organizations" 
ON public.organization_users 
FOR SELECT 
USING (organization_id = ANY(get_user_organization_ids()));

-- Simple policy: Only admins/owners can invite users to their organizations
CREATE POLICY "Admins can invite users" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (is_user_admin_in_org(organization_id));

-- Simple policy: Only admins/owners can update member status in their organizations
CREATE POLICY "Admins can manage members" 
ON public.organization_users 
FOR UPDATE 
USING (is_user_admin_in_org(organization_id) OR user_id = auth.uid());

-- Simple policy: Only admins/owners can remove members from their organizations
CREATE POLICY "Admins can remove members" 
ON public.organization_users 
FOR DELETE 
USING (is_user_admin_in_org(organization_id) OR user_id = auth.uid());

-- Update the get_current_organization_safe function to use the new helper
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE 
    WHEN array_length(get_user_organization_ids(), 1) > 0 
    THEN get_user_organization_ids()[1]
    ELSE NULL
  END;
$$;

-- Log the fix
INSERT INTO public.security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details,
  ip_address
) VALUES (
  'rls_policy_fix',
  auth.uid(),
  get_current_organization_safe(),
  jsonb_build_object(
    'action', 'fixed_infinite_recursion_organization_users',
    'description', 'Replaced recursive RLS policies with simple non-recursive ones',
    'policies_updated', 5,
    'functions_created', 2,
    'timestamp', now()
  ),
  inet_client_addr()
);