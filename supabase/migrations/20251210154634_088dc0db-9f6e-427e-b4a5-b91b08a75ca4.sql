-- Tabla para almacenar cobertura de transportadoras por municipio
CREATE TABLE public.shipping_coverage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id),
  municipality text NOT NULL,
  department text NOT NULL,
  dane_code text,
  postal_code text,
  coordinadora boolean DEFAULT false,
  interrapidisimo boolean DEFAULT false,
  deprisa boolean DEFAULT false,
  priority_carrier text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para búsqueda rápida
CREATE INDEX idx_shipping_coverage_municipality ON public.shipping_coverage(municipality);
CREATE INDEX idx_shipping_coverage_org ON public.shipping_coverage(organization_id);
CREATE UNIQUE INDEX idx_shipping_coverage_unique ON public.shipping_coverage(organization_id, municipality, department);

-- RLS
ALTER TABLE public.shipping_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipping coverage in their organization"
ON public.shipping_coverage FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins can manage shipping coverage"
ON public.shipping_coverage FOR ALL
USING (organization_id = get_current_organization_safe() AND get_current_user_role_safe() IN ('Administrador', 'Diseñador'))
WITH CHECK (organization_id = get_current_organization_safe());

-- Tabla para almacenar guías generadas
CREATE TABLE public.shipping_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  shopify_order_id bigint NOT NULL,
  order_number text NOT NULL,
  carrier text NOT NULL,
  tracking_number text,
  label_url text,
  shipment_id text,
  total_price numeric,
  status text DEFAULT 'created',
  destination_city text,
  destination_department text,
  destination_address text,
  recipient_name text,
  recipient_phone text,
  raw_response jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_shipping_labels_order ON public.shipping_labels(shopify_order_id);
CREATE INDEX idx_shipping_labels_org ON public.shipping_labels(organization_id);
CREATE INDEX idx_shipping_labels_tracking ON public.shipping_labels(tracking_number);
CREATE UNIQUE INDEX idx_shipping_labels_unique_order ON public.shipping_labels(organization_id, shopify_order_id);

-- RLS
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipping labels in their organization"
ON public.shipping_labels FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can create shipping labels in their organization"
ON public.shipping_labels FOR INSERT
WITH CHECK (organization_id = get_current_organization_safe());

CREATE POLICY "Admins can manage shipping labels"
ON public.shipping_labels FOR ALL
USING (organization_id = get_current_organization_safe() AND get_current_user_role_safe() IN ('Administrador', 'Diseñador'))
WITH CHECK (organization_id = get_current_organization_safe());

-- Trigger para updated_at
CREATE TRIGGER update_shipping_coverage_updated_at
BEFORE UPDATE ON public.shipping_coverage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_labels_updated_at
BEFORE UPDATE ON public.shipping_labels
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();