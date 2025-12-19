-- Tabla de manifiestos de envío
CREATE TABLE shipping_manifests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  manifest_number TEXT NOT NULL,
  carrier TEXT NOT NULL, -- 'coordinadora', 'interrapidisimo', 'deprisa', etc.
  manifest_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'picked_up'
  total_packages INTEGER DEFAULT 0,
  total_verified INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  pickup_confirmed_at TIMESTAMPTZ,
  pickup_confirmed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabla de items del manifiesto (guías)
CREATE TABLE manifest_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manifest_id UUID NOT NULL REFERENCES shipping_manifests(id) ON DELETE CASCADE,
  shipping_label_id UUID NOT NULL REFERENCES shipping_labels(id),
  shopify_order_id BIGINT NOT NULL,
  order_number TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  recipient_name TEXT,
  destination_city TEXT,
  scanned_at TIMESTAMPTZ, -- NULL = no escaneado, fecha = verificado
  scanned_by UUID,
  scan_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'missing', 'error'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_shipping_manifests_org ON shipping_manifests(organization_id);
CREATE INDEX idx_shipping_manifests_carrier ON shipping_manifests(carrier);
CREATE INDEX idx_shipping_manifests_status ON shipping_manifests(status);
CREATE INDEX idx_shipping_manifests_date ON shipping_manifests(manifest_date);
CREATE INDEX idx_manifest_items_manifest ON manifest_items(manifest_id);
CREATE INDEX idx_manifest_items_tracking ON manifest_items(tracking_number);
CREATE INDEX idx_manifest_items_scan_status ON manifest_items(scan_status);

-- Unique constraint para evitar duplicar guías en manifiestos
CREATE UNIQUE INDEX idx_manifest_items_unique_label ON manifest_items(shipping_label_id);

-- Enable RLS
ALTER TABLE shipping_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE manifest_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para shipping_manifests
CREATE POLICY "Users can view manifests in their organization"
ON shipping_manifests FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can create manifests in their organization"
ON shipping_manifests FOR INSERT
WITH CHECK (organization_id = get_current_organization_safe() AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update manifests in their organization"
ON shipping_manifests FOR UPDATE
USING (organization_id = get_current_organization_safe());

CREATE POLICY "Users can delete open manifests in their organization"
ON shipping_manifests FOR DELETE
USING (organization_id = get_current_organization_safe() AND status = 'open');

-- Políticas RLS para manifest_items
CREATE POLICY "Users can view manifest items via manifest"
ON manifest_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM shipping_manifests sm
  WHERE sm.id = manifest_items.manifest_id
  AND sm.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can insert manifest items via manifest"
ON manifest_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM shipping_manifests sm
  WHERE sm.id = manifest_items.manifest_id
  AND sm.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can update manifest items via manifest"
ON manifest_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM shipping_manifests sm
  WHERE sm.id = manifest_items.manifest_id
  AND sm.organization_id = get_current_organization_safe()
));

CREATE POLICY "Users can delete manifest items from open manifests"
ON manifest_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM shipping_manifests sm
  WHERE sm.id = manifest_items.manifest_id
  AND sm.organization_id = get_current_organization_safe()
  AND sm.status = 'open'
));

-- Trigger para actualizar updated_at
CREATE TRIGGER update_shipping_manifests_updated_at
  BEFORE UPDATE ON shipping_manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para generar número de manifiesto
CREATE OR REPLACE FUNCTION generate_manifest_number(org_id UUID, carrier_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  today_date TEXT;
  seq_num INTEGER;
  manifest_num TEXT;
BEGIN
  today_date := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM shipping_manifests
  WHERE organization_id = org_id
    AND carrier = carrier_code
    AND manifest_date = CURRENT_DATE;
  
  manifest_num := UPPER(LEFT(carrier_code, 3)) || '-' || today_date || '-' || LPAD(seq_num::TEXT, 3, '0');
  
  RETURN manifest_num;
END;
$$;