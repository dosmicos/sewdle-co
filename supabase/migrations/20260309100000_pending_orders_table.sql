-- Pending orders table: stores order data until payment is confirmed via Bold
CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  conversation_id UUID REFERENCES messaging_conversations(id),
  customer_phone TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  cedula TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  department TEXT NOT NULL,
  neighborhood TEXT,
  line_items JSONB NOT NULL,  -- Array of {productId, productName, variantId, variantName, quantity}
  notes TEXT,
  shipping_cost NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  bold_payment_link_id TEXT,  -- e.g. LNK_H7S4xxx
  bold_payment_url TEXT,      -- e.g. https://checkout.bold.co/LNK_H7S4xxx
  bold_reference TEXT,        -- Our reference sent to Bold
  status TEXT NOT NULL DEFAULT 'pending_payment',  -- pending_payment, paid, expired, cancelled, order_created
  shopify_order_id TEXT,      -- Filled after Shopify order is created
  shopify_order_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

-- Index for looking up by Bold payment link ID (webhook lookups)
CREATE INDEX idx_pending_orders_bold_link ON pending_orders(bold_payment_link_id);
CREATE INDEX idx_pending_orders_bold_ref ON pending_orders(bold_reference);
CREATE INDEX idx_pending_orders_org_status ON pending_orders(organization_id, status);
CREATE INDEX idx_pending_orders_conversation ON pending_orders(conversation_id);

-- RLS
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pending orders for their organization" ON pending_orders
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
