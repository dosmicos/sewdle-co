-- PHASE 1: CRITICAL RLS POLICY FIXES
-- Fix overly permissive order_supplies policies

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can create order supplies" ON public.order_supplies;
DROP POLICY IF EXISTS "Users can delete order supplies" ON public.order_supplies;  
DROP POLICY IF EXISTS "Users can update order supplies" ON public.order_supplies;
DROP POLICY IF EXISTS "Users can view order supplies" ON public.order_supplies;

-- Create secure, organization-based policies for order_supplies
CREATE POLICY "Users can create order supplies in their organization"
ON public.order_supplies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_supplies.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
);

CREATE POLICY "Users can view order supplies in their organization"
ON public.order_supplies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_supplies.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
);

CREATE POLICY "Users can update order supplies in their organization"
ON public.order_supplies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_supplies.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_supplies.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
);

CREATE POLICY "Users can delete order supplies in their organization"
ON public.order_supplies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_supplies.order_id 
    AND o.organization_id = get_current_organization_safe()
  )
);

-- Fix material_deliveries catch-all policy
DROP POLICY IF EXISTS "Workshop users can manage material deliveries" ON public.material_deliveries;

-- Create more restrictive material_deliveries policy
CREATE POLICY "Workshop users can manage material deliveries in their organization"
ON public.material_deliveries
FOR ALL
TO authenticated
USING (
  organization_id = get_current_organization_safe() 
  AND (
    get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
    OR (
      get_current_user_role_safe() = 'Taller'::text 
      AND workshop_id IN (
        SELECT ur.workshop_id
        FROM user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  )
)
WITH CHECK (
  organization_id = get_current_organization_safe()
  AND (
    get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text])
    OR (
      get_current_user_role_safe() = 'Taller'::text 
      AND workshop_id IN (
        SELECT ur.workshop_id
        FROM user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.workshop_id IS NOT NULL
      )
    )
  )
);

-- PHASE 2: DATABASE FUNCTION SECURITY
-- Fix search paths for all functions (sample of critical ones)
CREATE OR REPLACE FUNCTION public.get_workshop_product_price(workshop_id_param uuid, product_id_param uuid, calculation_date date DEFAULT CURRENT_DATE)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT wp.unit_price
  FROM public.workshop_pricing wp
  WHERE wp.workshop_id = workshop_id_param
    AND wp.product_id = product_id_param
    AND wp.effective_from <= calculation_date
    AND (wp.effective_until IS NULL OR wp.effective_until > calculation_date)
  ORDER BY wp.effective_from DESC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_organization()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_organization(org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users ou
    WHERE ou.user_id = auth.uid()
    AND ou.organization_id = org_id
    AND ou.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role_safe()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT COALESCE(
    (SELECT r.name
     FROM public.user_roles ur
     JOIN public.roles r ON ur.role_id = r.id
     WHERE ur.user_id = auth.uid() 
     LIMIT 1),
    'user'
  );
$function$;

-- Add audit logging for security events
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  organization_id uuid,
  event_type text NOT NULL,
  event_details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (
  get_current_user_role_safe() = 'Administrador'
  AND organization_id = get_current_organization_safe()
);

-- System can insert audit logs
CREATE POLICY "System can insert security audit logs"
ON public.security_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type_param text,
  event_details_param jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    user_id,
    organization_id,
    event_type,
    event_details,
    created_at
  ) VALUES (
    auth.uid(),
    get_current_organization_safe(),
    event_type_param,
    event_details_param,
    now()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_security_event(text, jsonb) TO authenticated;