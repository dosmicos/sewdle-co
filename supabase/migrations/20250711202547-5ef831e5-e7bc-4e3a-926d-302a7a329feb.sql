-- Financial Module Implementation - Phase 1: Database Structure

-- 1. Add payment method to workshops table
ALTER TABLE public.workshops 
ADD COLUMN payment_method TEXT DEFAULT 'approved' CHECK (payment_method IN ('approved', 'delivered'));

COMMENT ON COLUMN public.workshops.payment_method IS 'Payment method: approved (pay only approved units) or delivered (pay all delivered units)';

-- 2. Create workshop_pricing table for managing prices per workshop-product
CREATE TABLE public.workshop_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Ensure no overlapping price periods for same workshop-product
  CONSTRAINT workshop_pricing_unique UNIQUE (workshop_id, product_id, effective_from),
  -- Ensure effective_until is after effective_from
  CONSTRAINT workshop_pricing_date_check CHECK (effective_until IS NULL OR effective_until > effective_from)
);

-- 3. Create order_advances table for registering advances
CREATE TABLE public.order_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Create delivery_payments table for payment control
CREATE TABLE public.delivery_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  workshop_id UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  
  -- Calculation details
  total_units INTEGER NOT NULL CHECK (total_units >= 0),
  billable_units INTEGER NOT NULL CHECK (billable_units >= 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  gross_amount NUMERIC(10,2) NOT NULL CHECK (gross_amount >= 0),
  advance_deduction NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (advance_deduction >= 0),
  net_amount NUMERIC(10,2) NOT NULL CHECK (net_amount >= 0),
  
  -- Payment status and details
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
  payment_date DATE NULL,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  paid_by UUID REFERENCES auth.users(id),
  
  -- Ensure billable_units don't exceed total_units
  CONSTRAINT delivery_payments_units_check CHECK (billable_units <= total_units),
  -- Ensure one payment record per delivery
  CONSTRAINT delivery_payments_unique UNIQUE (delivery_id)
);

-- 5. Create payment_receipts table for attaching payment receipts
CREATE TABLE public.payment_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_payment_id UUID NOT NULL REFERENCES public.delivery_payments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  receipt_type TEXT NOT NULL DEFAULT 'payment' CHECK (receipt_type IN ('payment', 'invoice', 'other')),
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Create indexes for better performance
CREATE INDEX idx_workshop_pricing_workshop_product ON public.workshop_pricing(workshop_id, product_id);
CREATE INDEX idx_workshop_pricing_effective_dates ON public.workshop_pricing(effective_from, effective_until);
CREATE INDEX idx_order_advances_order_workshop ON public.order_advances(order_id, workshop_id);
CREATE INDEX idx_delivery_payments_status ON public.delivery_payments(payment_status);
CREATE INDEX idx_delivery_payments_workshop ON public.delivery_payments(workshop_id);
CREATE INDEX idx_delivery_payments_order ON public.delivery_payments(order_id);
CREATE INDEX idx_payment_receipts_delivery_payment ON public.payment_receipts(delivery_payment_id);

-- Enable RLS on all new tables
ALTER TABLE public.workshop_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workshop_pricing
CREATE POLICY "Authenticated users can view workshop pricing" 
ON public.workshop_pricing FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage workshop pricing" 
ON public.workshop_pricing FOR ALL 
USING (is_admin(auth.uid()));

-- RLS Policies for order_advances
CREATE POLICY "Authenticated users can view order advances" 
ON public.order_advances FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and designers can manage order advances" 
ON public.order_advances FOR ALL 
USING (get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]));

-- RLS Policies for delivery_payments
CREATE POLICY "Authenticated users can view delivery payments" 
ON public.delivery_payments FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and designers can manage delivery payments" 
ON public.delivery_payments FOR ALL 
USING (get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]));

-- RLS Policies for payment_receipts
CREATE POLICY "Authenticated users can view payment receipts" 
ON public.payment_receipts FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and designers can manage payment receipts" 
ON public.payment_receipts FOR ALL 
USING (get_current_user_role_safe() = ANY (ARRAY['Administrador'::text, 'Diseñador'::text]));

-- Create updated_at triggers
CREATE TRIGGER update_workshop_pricing_updated_at
  BEFORE UPDATE ON public.workshop_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_advances_updated_at
  BEFORE UPDATE ON public.order_advances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_delivery_payments_updated_at
  BEFORE UPDATE ON public.delivery_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();