-- Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  max_users INTEGER,
  max_orders_per_month INTEGER,
  max_workshops INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (needed for checkout)
CREATE POLICY "Public read access to active subscription plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_active = true);

-- Insert subscription plans with new prices
INSERT INTO public.subscription_plans (name, price, description, features, max_users, max_orders_per_month, max_workshops) VALUES
('starter', 29.00, 'Perfect for small businesses starting their digital transformation', 
 '["Up to 3 users", "10 orders per month", "5 workshops", "Basic support", "Mobile app access"]'::jsonb, 
 3, 10, 5),
('professional', 69.00, 'Ideal for growing businesses with advanced needs', 
 '["Up to 10 users", "Unlimited orders", "20 workshops", "Priority support", "Advanced analytics", "API access"]'::jsonb, 
 10, -1, 20),
('enterprise', 190.00, 'Complete solution for large organizations', 
 '["Unlimited users", "Unlimited orders", "Unlimited workshops", "24/7 dedicated support", "Custom integrations", "Advanced security", "Custom branding"]'::jsonb, 
 -1, -1, -1);