-- Add column-level security to prevent email harvesting

-- Revoke all access to profiles table by default
REVOKE ALL ON public.profiles FROM PUBLIC;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;

-- Grant SELECT on specific columns only (excluding email) for authenticated users
GRANT SELECT (id, name, avatar_url, organization_id, created_at, updated_at, requires_password_change) 
ON public.profiles TO authenticated;

-- Grant UPDATE on specific columns for users managing their own profile
GRANT UPDATE (name, avatar_url, updated_at) 
ON public.profiles TO authenticated;

-- Admin role needs full access - handled by RLS policies
-- Individual users can see their own email through RLS policy "Users can view own profile fully"

-- Add a security definer function for admins to access emails securely
CREATE OR REPLACE FUNCTION public.get_user_email_admin(user_id_param uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT email
  FROM public.profiles
  WHERE id = user_id_param
  AND (
    -- User can see own email
    auth.uid() = user_id_param
    OR
    -- Admin can see emails in their org
    (get_current_user_role_safe() = 'Administrador' 
     AND organization_id = get_current_organization_safe())
  )
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_email_admin IS
'Secure function to get user email. Only works for own profile or admin viewing org members. Use this instead of direct email column access.';

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.get_user_email_admin TO authenticated;