-- Fix critical security vulnerability in organization_users table
-- Current policy allows ANY authenticated user to perform ALL operations
-- This is a major security risk that needs immediate attention

-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Authenticated users can access organization_users" ON public.organization_users;

-- Create secure, granular RLS policies

-- 1. Allow users to view organization_users records only for organizations they belong to
CREATE POLICY "Users can view organization members in their organizations" 
ON public.organization_users 
FOR SELECT 
USING (
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.status = 'active'
  )
);

-- 2. Allow users to view their own organization_users records across all orgs
CREATE POLICY "Users can view their own organization memberships" 
ON public.organization_users 
FOR SELECT 
USING (user_id = auth.uid());

-- 3. Only organization owners and admins can invite new users (INSERT)
CREATE POLICY "Organization owners and admins can invite users" 
ON public.organization_users 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.role IN ('owner', 'admin') 
    AND ou.status = 'active'
  )
);

-- 4. Only organization owners and admins can update user roles/status (UPDATE)
-- Users can update their own status (e.g., accept invitation)
CREATE POLICY "Organization owners and admins can manage members" 
ON public.organization_users 
FOR UPDATE 
USING (
  -- Allow if user is owner/admin of the organization
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.role IN ('owner', 'admin') 
    AND ou.status = 'active'
  )
  OR
  -- Allow users to update their own membership status (e.g., accept invitations)
  (user_id = auth.uid())
);

-- 5. Only organization owners and admins can remove users (DELETE)
-- Users can remove themselves from organizations
CREATE POLICY "Organization owners and admins can remove members" 
ON public.organization_users 
FOR DELETE 
USING (
  -- Allow if user is owner/admin of the organization
  organization_id IN (
    SELECT ou.organization_id 
    FROM public.organization_users ou 
    WHERE ou.user_id = auth.uid() 
    AND ou.role IN ('owner', 'admin') 
    AND ou.status = 'active'
  )
  OR
  -- Allow users to remove themselves from organizations
  (user_id = auth.uid())
);

-- Add additional security: Prevent users from escalating their own privileges
-- This trigger ensures users cannot make themselves owner/admin when updating their own record
CREATE OR REPLACE FUNCTION prevent_self_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is updating their own record and changing role
  IF OLD.user_id = auth.uid() AND NEW.role != OLD.role THEN
    -- Check if the user is trying to give themselves owner/admin privileges
    IF NEW.role IN ('owner', 'admin') AND OLD.role NOT IN ('owner', 'admin') THEN
      -- Verify that the current user is already an owner/admin in this organization
      IF NOT EXISTS (
        SELECT 1 FROM public.organization_users 
        WHERE user_id = auth.uid() 
        AND organization_id = NEW.organization_id 
        AND role IN ('owner', 'admin') 
        AND status = 'active'
        AND id != NEW.id  -- Exclude the current record being updated
      ) THEN
        RAISE EXCEPTION 'You cannot grant yourself owner or admin privileges';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger
DROP TRIGGER IF EXISTS prevent_self_privilege_escalation_trigger ON public.organization_users;
CREATE TRIGGER prevent_self_privilege_escalation_trigger
  BEFORE UPDATE ON public.organization_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_privilege_escalation();

-- Log this security fix for audit purposes
INSERT INTO public.security_audit_log (
  event_type,
  user_id,
  organization_id,
  event_details
) VALUES (
  'security_policy_update',
  auth.uid(),
  NULL,
  jsonb_build_object(
    'table', 'organization_users',
    'action', 'fixed_overly_permissive_rls_policies',
    'severity', 'critical',
    'description', 'Replaced permissive ALL policy with granular role-based policies',
    'timestamp', now()
  )
);