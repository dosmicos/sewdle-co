-- Create table for order timeline phases
CREATE TABLE public.order_timeline_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  phase_type TEXT NOT NULL CHECK (phase_type IN (
    'order_received',
    'supplies_packed', 
    'caps_sent_embroidery',
    'embroidered_caps_received',
    'final_production_delivered'
  )),
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(order_id, phase_type)
);

-- Enable RLS
ALTER TABLE public.order_timeline_phases ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view timeline phases in their organization"
  ON public.order_timeline_phases
  FOR SELECT
  USING (
    organization_id = get_current_organization_safe()
  );

CREATE POLICY "Users can create timeline phases in their organization"
  ON public.order_timeline_phases
  FOR INSERT
  WITH CHECK (
    organization_id = get_current_organization_safe() AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update timeline phases in their organization"
  ON public.order_timeline_phases
  FOR UPDATE
  USING (
    organization_id = get_current_organization_safe() AND
    (is_current_user_admin() OR has_permission(auth.uid(), 'orders', 'edit'))
  );

-- Create index for faster queries
CREATE INDEX idx_order_timeline_phases_order_id ON public.order_timeline_phases(order_id);
CREATE INDEX idx_order_timeline_phases_org_id ON public.order_timeline_phases(organization_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_order_timeline_phases_updated_at
  BEFORE UPDATE ON public.order_timeline_phases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();