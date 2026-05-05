-- Create picking_packing_orders table
CREATE TABLE IF NOT EXISTS picking_packing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id BIGINT NOT NULL REFERENCES shopify_orders(shopify_order_id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Estados operativos internos
  operational_status TEXT NOT NULL DEFAULT 'pending' CHECK (operational_status IN ('pending', 'picking', 'packing', 'ready_to_ship', 'shipped')),
  
  -- Tracking
  picked_at TIMESTAMPTZ,
  picked_by UUID REFERENCES auth.users(id),
  packed_at TIMESTAMPTZ,
  packed_by UUID REFERENCES auth.users(id),
  shipped_at TIMESTAMPTZ,
  shipped_by UUID REFERENCES auth.users(id),
  
  -- Notas internas
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_picking_orders_status ON picking_packing_orders(operational_status);
CREATE INDEX IF NOT EXISTS idx_picking_orders_org ON picking_packing_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_picking_orders_shopify ON picking_packing_orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_picking_orders_dates ON picking_packing_orders(created_at, operational_status);

-- Enable RLS
ALTER TABLE picking_packing_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view picking orders in their organization"
ON picking_packing_orders FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert picking orders in their organization"
ON picking_packing_orders FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update picking orders in their organization"
ON picking_packing_orders FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_users 
    WHERE user_id = auth.uid()
  )
);

-- Add warehouse_location column to product_variants
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS warehouse_location TEXT;

COMMENT ON COLUMN product_variants.warehouse_location IS 'Ubicación física en bodega (ej: A1-B3, Pasillo 2-Estante 5)';

-- Create picking_status_history table for tracking status changes
CREATE TABLE IF NOT EXISTS picking_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  picking_order_id UUID NOT NULL REFERENCES picking_packing_orders(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL CHECK (new_status IN ('pending', 'picking', 'packing', 'ready_to_ship', 'shipped')),
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_order ON picking_status_history(picking_order_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created ON picking_status_history(created_at);

-- Enable RLS
ALTER TABLE picking_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history"
ON picking_status_history FOR SELECT
USING (
  picking_order_id IN (
    SELECT id FROM picking_packing_orders
    WHERE organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert status history"
ON picking_status_history FOR INSERT
WITH CHECK (
  picking_order_id IN (
    SELECT id FROM picking_packing_orders
    WHERE organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid()
    )
  )
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_picking_packing_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_picking_packing_orders_timestamp
BEFORE UPDATE ON picking_packing_orders
FOR EACH ROW
EXECUTE FUNCTION update_picking_packing_orders_updated_at();