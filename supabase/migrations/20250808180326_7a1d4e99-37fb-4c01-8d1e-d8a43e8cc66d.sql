-- Create function to assign admin role to existing users without roles
CREATE OR REPLACE FUNCTION public.assign_admin_role_to_users_without_role()
RETURNS TABLE(user_id uuid, assigned boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  admin_role_id uuid;
  org_id uuid;
BEGIN
  -- Get admin role ID
  SELECT id INTO admin_role_id
  FROM public.roles 
  WHERE name = 'Administrador' AND is_system = true
  LIMIT 1;
  
  IF admin_role_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, 'Admin role not found'::text;
    RETURN;
  END IF;
  
  -- Find users who have organization but no role
  FOR user_record IN
    SELECT DISTINCT 
      ou.user_id,
      ou.organization_id
    FROM public.organization_users ou
    LEFT JOIN public.user_roles ur ON ou.user_id = ur.user_id
    WHERE ou.status = 'active' 
      AND ur.user_id IS NULL
  LOOP
    BEGIN
      -- Assign admin role
      INSERT INTO public.user_roles (user_id, role_id, organization_id)
      VALUES (user_record.user_id, admin_role_id, user_record.organization_id);
      
      RETURN QUERY SELECT user_record.user_id, true, 'Role assigned successfully'::text;
      
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT user_record.user_id, false, SQLERRM::text;
    END;
  END LOOP;
  
  RETURN;
END;
$$;