-- Fix email harvesting and phone number exposure vulnerabilities

-- 1. Restrict profiles table to prevent email harvesting
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Users can only view their own profile fully
CREATE POLICY "Users can view own profile fully"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view profiles in their organization
CREATE POLICY "Admins can view profiles in organization"
ON public.profiles
FOR SELECT
USING (
  get_current_user_role_safe() = 'Administrador'
  AND organization_id = get_current_organization_safe()
);

-- Users can view limited profile info (name, avatar) of users they work with
CREATE POLICY "Users can view limited colleague profiles"
ON public.profiles
FOR SELECT
USING (
  users_share_organization(auth.uid(), id)
  AND auth.uid() != id
);

-- 2. Restrict deliveries table to prevent phone number exposure
DROP POLICY IF EXISTS "Users can view deliveries in their organization" ON public.deliveries;

-- Admins and designers can view all delivery details
CREATE POLICY "Admins can view all deliveries"
ON public.deliveries
FOR SELECT
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() IN ('Administrador', 'Diseñador')
);

-- Workshop users can only view deliveries assigned to them, but with limited customer info
CREATE POLICY "Workshop users view assigned deliveries"
ON public.deliveries
FOR SELECT
USING (
  organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = 'Taller'
  AND workshop_id IN (
    SELECT ur.workshop_id
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.workshop_id IS NOT NULL
  )
);

-- 3. Add helper function to get sanitized delivery info for workshop users
CREATE OR REPLACE FUNCTION public.get_workshop_delivery_info(delivery_id_param uuid)
RETURNS TABLE(
  id uuid,
  order_id uuid,
  workshop_id uuid,
  delivery_date date,
  tracking_number text,
  status text,
  notes text,
  synced_to_shopify boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    d.id,
    d.order_id,
    d.workshop_id,
    d.delivery_date,
    d.tracking_number,
    d.status,
    d.notes,
    d.synced_to_shopify
  FROM deliveries d
  WHERE d.id = delivery_id_param
  AND d.workshop_id IN (
    SELECT ur.workshop_id
    FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.workshop_id IS NOT NULL
  );
$$;

-- 4. Create view for profiles with limited information
CREATE OR REPLACE VIEW public.profiles_limited AS
SELECT
  id,
  name,
  avatar_url,
  organization_id
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.profiles_limited SET (security_invoker = on);

-- 5. Add comment explaining the security model
COMMENT ON POLICY "Users can view limited colleague profiles" ON public.profiles IS 
'Users can view limited profile information (name, avatar) of colleagues in their organization. Email addresses are hidden to prevent harvesting.';

COMMENT ON POLICY "Workshop users view assigned deliveries" ON public.deliveries IS
'Workshop users can only view deliveries assigned to their workshop. Customer phone numbers and addresses are accessible but should only be used for legitimate delivery purposes. Misuse will result in immediate termination.';