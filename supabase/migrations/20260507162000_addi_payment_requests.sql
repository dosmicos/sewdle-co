-- Add Addi payment request support to pending WhatsApp orders.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS addi_credentials JSONB DEFAULT '{}'::jsonb;

ALTER TABLE pending_orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'bold',
  ADD COLUMN IF NOT EXISTS addi_order_id TEXT,
  ADD COLUMN IF NOT EXISTS addi_application_id TEXT,
  ADD COLUMN IF NOT EXISTS addi_payment_url TEXT,
  ADD COLUMN IF NOT EXISTS addi_status TEXT,
  ADD COLUMN IF NOT EXISTS addi_callback_payload JSONB;

CREATE INDEX IF NOT EXISTS idx_pending_orders_provider_status
  ON pending_orders(payment_provider, status);

CREATE INDEX IF NOT EXISTS idx_pending_orders_addi_order_id
  ON pending_orders(addi_order_id);

CREATE INDEX IF NOT EXISTS idx_pending_orders_addi_application_id
  ON pending_orders(addi_application_id);
