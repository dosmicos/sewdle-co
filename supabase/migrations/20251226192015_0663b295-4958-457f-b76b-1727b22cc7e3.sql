-- Tabla para registro de facturas emitidas en Alegra
CREATE TABLE public.alegra_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shopify_order_id BIGINT NOT NULL,
  shopify_order_number TEXT NOT NULL,
  alegra_invoice_id INTEGER NOT NULL,
  alegra_invoice_number TEXT,
  cufe TEXT,
  stamped BOOLEAN DEFAULT false,
  stamped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Índice único: evitar duplicados por pedido+factura
  UNIQUE(organization_id, shopify_order_id, alegra_invoice_id)
);

-- Índices para búsqueda rápida
CREATE INDEX idx_alegra_invoices_order ON public.alegra_invoices(shopify_order_id);
CREATE INDEX idx_alegra_invoices_org_stamped ON public.alegra_invoices(organization_id, stamped);
CREATE INDEX idx_alegra_invoices_order_number ON public.alegra_invoices(shopify_order_number);

-- RLS
ALTER TABLE public.alegra_invoices ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver/gestionar facturas de su organización
CREATE POLICY "Users can view org invoices" ON public.alegra_invoices
  FOR SELECT USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can insert org invoices" ON public.alegra_invoices
  FOR INSERT WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Users can update org invoices" ON public.alegra_invoices
  FOR UPDATE USING (organization_id = get_current_organization_safe());

-- Trigger para updated_at
CREATE TRIGGER update_alegra_invoices_updated_at
  BEFORE UPDATE ON public.alegra_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();