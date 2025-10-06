-- Fix remaining security issues (corrected)

-- 1. Drop profiles_limited view to resolve false positive
DROP VIEW IF EXISTS public.profiles_limited CASCADE;

-- 2. Fix subscription_plans - restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Public read access to active subscription plans" ON public.subscription_plans;

CREATE POLICY "Authenticated users can view subscription plans"
ON public.subscription_plans
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admins can manage all subscription plans
CREATE POLICY "Admins can manage subscription plans"
ON public.subscription_plans
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

COMMENT ON POLICY "Authenticated users can view subscription plans" ON public.subscription_plans IS
'Only authenticated users can view subscription plans to prevent competitor analysis of pricing strategy.';