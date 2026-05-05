-- Drop the restrictive admin-only policy for managing channels
DROP POLICY IF EXISTS "Admins can manage channels" ON public.messaging_channels;

-- Create a function to check if user has messaging edit permission
CREATE OR REPLACE FUNCTION public.user_has_messaging_permission(org_id uuid, permission_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_permissions jsonb;
BEGIN
  -- Get the user's role permissions for this organization
  SELECT r.permissions INTO user_permissions
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
    AND ur.organization_id = org_id
  LIMIT 1;
  
  -- Check if user has the specified messaging permission
  IF user_permissions IS NOT NULL THEN
    RETURN COALESCE((user_permissions->'messaging'->>permission_type)::boolean, false);
  END IF;
  
  -- Also check if user is org admin/owner (they have full access)
  RETURN EXISTS (
    SELECT 1 FROM organization_users
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role IN ('admin', 'owner')
  );
END;
$$;

-- Create policy allowing users with messaging edit permission to manage channels
CREATE POLICY "Users with messaging permission can manage channels"
ON public.messaging_channels
FOR ALL
TO authenticated
USING (
  -- User can view if they're in the organization
  organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- User can modify if they have messaging edit permission OR are admin/owner
  public.user_has_messaging_permission(organization_id, 'edit')
);

-- Same for messaging_conversation_tags - allow users with messaging permission
DROP POLICY IF EXISTS "Users can manage tags in their organization" ON public.messaging_conversation_tags;

CREATE POLICY "Users with messaging permission can manage tags"
ON public.messaging_conversation_tags
FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  public.user_has_messaging_permission(organization_id, 'edit')
);