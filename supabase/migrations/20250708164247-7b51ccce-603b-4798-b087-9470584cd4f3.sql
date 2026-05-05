-- Agregar campos para trackear sincronización por delivery_item
ALTER TABLE delivery_items 
ADD COLUMN synced_to_shopify BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN sync_attempt_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN last_sync_attempt TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN sync_error_message TEXT DEFAULT NULL;

-- Crear un índice para mejorar las consultas de sincronización
CREATE INDEX idx_delivery_items_sync_status ON delivery_items(synced_to_shopify, delivery_id);

-- Comentarios para documentar los nuevos campos
COMMENT ON COLUMN delivery_items.synced_to_shopify IS 'Indica si este item específico ha sido sincronizado con Shopify';
COMMENT ON COLUMN delivery_items.sync_attempt_count IS 'Número de intentos de sincronización para este item';
COMMENT ON COLUMN delivery_items.last_sync_attempt IS 'Timestamp del último intento de sincronización';
COMMENT ON COLUMN delivery_items.sync_error_message IS 'Mensaje de error del último intento de sincronización fallido';