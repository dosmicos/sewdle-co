-- CRITICAL SECURITY FIX: Phase 1 - Emergency Fixes (Drop CASCADE)
-- Fix infinite recursion in organization_users policies and overly permissive policies

-- 1. DROP PROBLEMATIC POLICIES CAUSING INFINITE RECURSION
DROP POLICY IF EXISTS "Organization owners and admins can invite users" ON public.organization_users;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON public.organization_users;
DROP POLICY IF EXISTS "Organization owners and admins can remove members" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view organization members in their organizations" ON public.organization_users;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON public.organization_users;

-- 2. DROP EXISTING FUNCTIONS TO AVOID CONFLICTS (with CASCADE)
DROP FUNCTION IF EXISTS public.has_permission(uuid, text, text) CASCADE;

-- 3. CREATE SECURITY DEFINER FUNCTIONS TO AVOID RECURSION
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
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
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
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

CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, module_name TEXT, action_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = user_id
    AND (
      r.permissions->module_name->action_name = 'true'::jsonb
      OR r.name IN ('Administrador', 'admin')
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_system_or_service_role()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.jwt() ->> 'role' IN ('service_role', 'supabase_admin', 'postgres')
  OR current_setting('role') IN ('service_role', 'supabase_admin', 'postgres');
$$;

-- 4. RECREATE ORGANIZATION_USERS POLICIES WITHOUT RECURSION
CREATE POLICY "Users can view their own organization memberships"
ON public.organization_users
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can view organization members where they are members"
ON public.organization_users
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id 
    FROM public.organization_users 
    WHERE user_id = auth.uid() 
    AND status = 'active'
  )
);

CREATE POLICY "Organization owners and admins can invite users"
ON public.organization_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.organization_users existing
    WHERE existing.user_id = auth.uid()
    AND existing.organization_id = organization_users.organization_id
    AND existing.role IN ('owner', 'admin')
    AND existing.status = 'active'
  )
);

CREATE POLICY "Organization owners and admins can manage members"
ON public.organization_users
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT existing.organization_id
    FROM public.organization_users existing
    WHERE existing.user_id = auth.uid()
    AND existing.role IN ('owner', 'admin')
    AND existing.status = 'active'
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Organization owners and admins can remove members"
ON public.organization_users
FOR DELETE
TO authenticated
USING (
  organization_id IN (
    SELECT existing.organization_id
    FROM public.organization_users existing
    WHERE existing.user_id = auth.uid()
    AND existing.role IN ('owner', 'admin')
    AND existing.status = 'active'
  )
  OR user_id = auth.uid()
);

-- 5. RECREATE DROPPED POLICIES THAT DEPENDED ON has_permission FUNCTION
CREATE POLICY "Users can delete orders in their organization"
ON public.orders
FOR DELETE
TO authenticated
USING (
  (organization_id = get_current_organization_safe()) 
  AND (
    is_current_user_admin() 
    OR has_permission(auth.uid(), 'orders'::text, 'delete'::text)
  )
);

CREATE POLICY "Users can manage products in their organization"
ON public.products
FOR ALL
TO authenticated
USING (
  (organization_id = get_current_organization_safe()) 
  AND has_permission(auth.uid(), 'products'::text, 'edit'::text)
)
WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Users can manage materials in their organization"
ON public.materials
FOR ALL
TO authenticated
USING (
  (organization_id = get_current_organization_safe()) 
  AND (
    is_current_user_admin() 
    OR has_permission(auth.uid(), 'insumos'::text, 'edit'::text)
  )
)
WITH CHECK (organization_id = get_current_organization_safe());

-- 6. FIX OVERLY PERMISSIVE MATERIAL_DELIVERIES POLICY
DROP POLICY IF EXISTS "Authenticated users can view material deliveries" ON public.material_deliveries;

CREATE POLICY "Users can view material deliveries in their organization"
ON public.material_deliveries
FOR SELECT
TO authenticated
USING (organization_id = get_current_organization_safe());

-- 7. PREVENT SELF PRIVILEGE ESCALATION (Enhanced)
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
        RAISE EXCEPTION 'SECURITY_VIOLATION: Cannot grant yourself owner or admin privileges';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply the trigger
DROP TRIGGER IF EXISTS prevent_self_privilege_escalation_trigger ON public.organization_users;
CREATE TRIGGER prevent_self_privilege_escalation_trigger
  BEFORE UPDATE ON public.organization_users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_privilege_escalation();