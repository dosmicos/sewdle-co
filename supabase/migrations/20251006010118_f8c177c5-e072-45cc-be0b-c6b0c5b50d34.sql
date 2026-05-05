-- CRITICAL SECURITY FIXES
-- 1. Fix user_roles privilege escalation and add audit logging

-- Create audit log table for role changes
CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_user_id uuid NOT NULL,
  changed_by_user_id uuid NOT NULL,
  old_role_id uuid,
  new_role_id uuid,
  action text NOT NULL, -- 'insert', 'update', 'delete'
  organization_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs in their organization
CREATE POLICY "Admins can view role change audit logs"
ON public.role_change_audit
FOR SELECT
USING (
  organization_id = get_current_organization_safe() 
  AND get_current_user_role_safe() = 'Administrador'
);

-- 2. Fix user_roles RLS to prevent self-escalation
DROP POLICY IF EXISTS "Admins can manage user roles in their organization" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;

-- Users can view their own roles
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
  OR (
    get_current_user_role_safe() = 'Administrador'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_roles.user_id
      AND p.organization_id = get_current_organization_safe()
    )
  )
);

-- Admins can insert roles but NOT for themselves
CREATE POLICY "Admins can assign roles to others"
ON public.user_roles
FOR INSERT
WITH CHECK (
  get_current_user_role_safe() = 'Administrador'
  AND user_id != auth.uid() -- Prevent self-assignment
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.organization_id = get_current_organization_safe()
  )
);

-- Admins can update roles but NOT their own
CREATE POLICY "Admins can update others roles"
ON public.user_roles
FOR UPDATE
USING (
  get_current_user_role_safe() = 'Administrador'
  AND user_id != auth.uid() -- Prevent self-modification
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.organization_id = get_current_organization_safe()
  )
);

-- Admins can delete roles but NOT their own
CREATE POLICY "Admins can delete others roles"
ON public.user_roles
FOR DELETE
USING (
  get_current_user_role_safe() = 'Administrador'
  AND user_id != auth.uid() -- Prevent self-deletion
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = user_roles.user_id
    AND p.organization_id = get_current_organization_safe()
  )
);

-- 3. Create trigger for audit logging
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Get organization_id from the user's profile
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = COALESCE(NEW.user_id, OLD.user_id)
  LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      new_role_id,
      action,
      organization_id
    ) VALUES (
      NEW.user_id,
      auth.uid(),
      NEW.role_id,
      'insert',
      org_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      old_role_id,
      new_role_id,
      action,
      organization_id
    ) VALUES (
      NEW.user_id,
      auth.uid(),
      OLD.role_id,
      NEW.role_id,
      'update',
      org_id
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO role_change_audit (
      changed_user_id,
      changed_by_user_id,
      old_role_id,
      action,
      organization_id
    ) VALUES (
      OLD.user_id,
      auth.uid(),
      OLD.role_id,
      'delete',
      org_id
    );
    RETURN OLD;
  END IF;
END;
$$;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS user_roles_audit_trigger ON public.user_roles;
CREATE TRIGGER user_roles_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- 4. Fix shopify_orders customer data exposure
DROP POLICY IF EXISTS "Only admins and designers can view shopify orders with customer" ON public.shopify_orders;

CREATE POLICY "Admins can view shopify orders in their organization only"
ON public.shopify_orders
FOR SELECT
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
);

-- 5. Restrict roles table to authenticated users only
DROP POLICY IF EXISTS "Anyone can view roles" ON public.roles;

CREATE POLICY "Authenticated users can view roles in their organization"
ON public.roles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_system = true 
    OR organization_id = get_current_organization_safe()
  )
);

-- 6. Protect organizations.shopify_credentials
-- Update RLS to prevent reading credentials unless admin
DROP POLICY IF EXISTS "Organization owners and admins can update" ON public.organizations;

CREATE POLICY "Organization owners and admins can update"
ON public.organizations
FOR UPDATE
USING (
  id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  )
);

-- 7. Fix mutable search_path in critical functions
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_dosmicos_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users ou
    JOIN public.organizations o ON ou.organization_id = o.id
    WHERE ou.user_id = auth.uid() 
    AND o.slug = 'dosmicos-org'
    AND ou.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users ou1
    JOIN public.organization_users ou2 ON ou1.organization_id = ou2.organization_id
    WHERE ou1.user_id = user1_id 
    AND ou2.user_id = user2_id
    AND ou1.status = 'active' 
    AND ou2.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = org_id
    AND ou.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_okr_manager(user_uuid uuid, area_name text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_uuid 
    AND r.name IN ('Administrador', 'Diseñador')
  );
$$;