-- Update subscription plans to have logical user limits
-- Starter: 5 workshops + 2 brand users = 7 users
-- Professional: 20 workshops + 2 brand users = 22 users
-- Enterprise: unlimited (already -1)

UPDATE public.subscription_plans 
SET max_users = 7 
WHERE name = 'starter';

UPDATE public.subscription_plans 
SET max_users = 22 
WHERE name = 'professional';