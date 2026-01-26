-- Columnas de control de concurrencia para prevenir race conditions en facturación automática
ALTER TABLE shopify_orders 
ADD COLUMN IF NOT EXISTS auto_invoice_processing BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_invoice_processing_at TIMESTAMPTZ;

-- Índice parcial para queries de lock eficientes
CREATE INDEX IF NOT EXISTS idx_shopify_orders_auto_invoice_processing 
ON shopify_orders (shopify_order_id) 
WHERE auto_invoice_processing = true;