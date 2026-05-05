-- Security Fix 1: Fix RLS Policy Gaps - Add granular policies instead of broad "ALL" policies

-- Fix delivery_items policies (replace broad ALL policy with specific ones)
DROP POLICY IF EXISTS "Users can manage delivery items in their organization" ON public.delivery_items;

CREATE POLICY "Users can view delivery items in their organization" 
ON public.delivery_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM deliveries d 
  WHERE d.id = delivery_items.delivery_id 
  AND d.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can create delivery items in their organization" 
ON public.delivery_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM deliveries d 
  WHERE d.id = delivery_items.delivery_id 
  AND d.organization_id = get_current_organization_safe()
  AND (get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']) 
       OR (get_current_user_role_safe() = 'Taller' AND d.workshop_id IN (
         SELECT ur.workshop_id FROM user_roles ur 
         WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
       )))
));

CREATE POLICY "Users can update delivery items in their organization" 
ON public.delivery_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM deliveries d 
  WHERE d.id = delivery_items.delivery_id 
  AND d.organization_id = get_current_organization_safe()
  AND (get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']) 
       OR (get_current_user_role_safe() = 'Taller' AND d.workshop_id IN (
         SELECT ur.workshop_id FROM user_roles ur 
         WHERE ur.user_id = auth.uid() AND ur.workshop_id IS NOT NULL
       )))
));

CREATE POLICY "Admins can delete delivery items in their organization" 
ON public.delivery_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM deliveries d 
  WHERE d.id = delivery_items.delivery_id 
  AND d.organization_id = get_current_organization_safe()
  AND get_current_user_role_safe() = 'Administrador'
));

-- Fix product_variants policies (replace broad ALL policy with specific ones)
DROP POLICY IF EXISTS "Users can manage product variants in their organization" ON public.product_variants;

CREATE POLICY "Users can view product variants in their organization" 
ON public.product_variants FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_variants.product_id 
  AND p.organization_id = get_current_organization_safe()
));

CREATE POLICY "Authorized users can create product variants" 
ON public.product_variants FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_variants.product_id 
  AND p.organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'products', 'edit')
));

CREATE POLICY "Authorized users can update product variants" 
ON public.product_variants FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_variants.product_id 
  AND p.organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'products', 'edit')
));

CREATE POLICY "Authorized users can delete product variants" 
ON public.product_variants FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM products p 
  WHERE p.id = product_variants.product_id 
  AND p.organization_id = get_current_organization_safe()
  AND has_permission(auth.uid(), 'products', 'edit')
));

-- Fix order_items policies (replace broad ALL policy with specific ones)
DROP POLICY IF EXISTS "Users can manage order items in their organization" ON public.order_items;

CREATE POLICY "Users can view order items in their organization" 
ON public.order_items FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM orders o 
  WHERE o.id = order_items.order_id 
  AND o.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can create order items in their organization" 
ON public.order_items FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM orders o 
  WHERE o.id = order_items.order_id 
  AND o.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can update order items in their organization" 
ON public.order_items FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM orders o 
  WHERE o.id = order_items.order_id 
  AND o.organization_id = get_current_organization_safe()
));

CREATE POLICY "Authorized users can delete order items" 
ON public.order_items FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM orders o 
  WHERE o.id = order_items.order_id 
  AND o.organization_id = get_current_organization_safe()
  AND (is_current_user_admin() OR has_permission(auth.uid(), 'orders', 'delete'))
));

-- Fix replenishment_config policies (replace broad ALL policy with specific ones)
DROP POLICY IF EXISTS "Users can manage replenishment config in their organization" ON public.replenishment_config;

CREATE POLICY "Users can view replenishment config in their organization" 
ON public.replenishment_config FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins can create replenishment config" 
ON public.replenishment_config FOR INSERT 
WITH CHECK (organization_id = get_current_organization_safe() 
           AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']));

CREATE POLICY "Admins can update replenishment config" 
ON public.replenishment_config FOR UPDATE 
USING (organization_id = get_current_organization_safe() 
       AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']));

CREATE POLICY "Admins can delete replenishment config" 
ON public.replenishment_config FOR DELETE 
USING (organization_id = get_current_organization_safe() 
       AND get_current_user_role_safe() = 'Administrador');

-- Fix replenishment_suggestions policies (replace broad ALL policy with specific ones)
DROP POLICY IF EXISTS "Users can manage replenishment suggestions in their organizatio" ON public.replenishment_suggestions;

CREATE POLICY "Users can view replenishment suggestions in their organization" 
ON public.replenishment_suggestions FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "System can create replenishment suggestions" 
ON public.replenishment_suggestions FOR INSERT 
WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Admins can update replenishment suggestions" 
ON public.replenishment_suggestions FOR UPDATE 
USING (organization_id = get_current_organization_safe() 
       AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']));

CREATE POLICY "Admins can delete replenishment suggestions" 
ON public.replenishment_suggestions FOR DELETE 
USING (organization_id = get_current_organization_safe() 
       AND get_current_user_role_safe() = 'Administrador');

-- Security Fix 2: Secure Database Functions - Add search_path settings to all functions

-- Update all functions to include SET search_path TO '' for security
CREATE OR REPLACE FUNCTION public.get_current_organization_safe()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT ou.organization_id
  FROM public.organization_users ou
  WHERE ou.user_id = auth.uid()
  AND ou.status = 'active'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.users_share_organization(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM public.organization_users ou1
    JOIN public.organization_users ou2 ON ou1.organization_id = ou2.organization_id
    WHERE ou1.user_id = user1_id 
    AND ou2.user_id = user2_id
    AND ou1.status = 'active' 
    AND ou2.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Security Fix 3: Add validation trigger for financial data
CREATE OR REPLACE FUNCTION public.validate_financial_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Validate monetary amounts are positive and reasonable
  IF TG_TABLE_NAME = 'delivery_payments' THEN
    IF NEW.gross_amount < 0 OR NEW.net_amount < 0 OR NEW.advance_deduction < 0 THEN
      RAISE EXCEPTION 'Financial amounts cannot be negative';
    END IF;
    IF NEW.gross_amount > 1000000 OR NEW.net_amount > 1000000 THEN
      RAISE EXCEPTION 'Financial amounts exceed reasonable limits';
    END IF;
  END IF;
  
  IF TG_TABLE_NAME = 'order_advances' THEN
    IF NEW.amount < 0 THEN
      RAISE EXCEPTION 'Advance amount cannot be negative';
    END IF;
    IF NEW.amount > 1000000 THEN
      RAISE EXCEPTION 'Advance amount exceeds reasonable limits';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add validation triggers for financial tables
DROP TRIGGER IF EXISTS validate_delivery_payment_amounts ON public.delivery_payments;
CREATE TRIGGER validate_delivery_payment_amounts
  BEFORE INSERT OR UPDATE ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_financial_amounts();

DROP TRIGGER IF EXISTS validate_order_advance_amounts ON public.order_advances;
CREATE TRIGGER validate_order_advance_amounts
  BEFORE INSERT OR UPDATE ON public.order_advances
  FOR EACH ROW EXECUTE FUNCTION public.validate_financial_amounts();

-- Security Fix 4: Fix orphaned profile data
UPDATE public.profiles 
SET organization_id = (
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = profiles.id 
  AND status = 'active' 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Add constraint to prevent future orphaned profiles
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_must_have_organization 
CHECK (organization_id IS NOT NULL);

-- Security Fix 5: Add audit logging for sensitive operations
CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  user_id uuid,
  organization_id uuid,
  event_details jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION public.log_security_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.security_audit_log (
    event_type,
    user_id,
    organization_id,
    event_details
  ) VALUES (
    TG_OP || '_' || TG_TABLE_NAME,
    auth.uid(),
    get_current_organization_safe(),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$function$;

-- Add audit triggers for financial tables
CREATE TRIGGER audit_delivery_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_payments
  FOR EACH ROW EXECUTE FUNCTION public.log_security_event();

CREATE TRIGGER audit_order_advances
  AFTER INSERT OR UPDATE OR DELETE ON public.order_advances
  FOR EACH ROW EXECUTE FUNCTION public.log_security_event();