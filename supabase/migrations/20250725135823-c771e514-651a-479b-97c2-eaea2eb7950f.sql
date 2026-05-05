-- Corregir estados de sincronización inconsistentes
-- Actualizar items que están marcados como sincronizados pero no han sido revisados
UPDATE delivery_items 
SET synced_to_shopify = false, 
    last_sync_attempt = NULL, 
    sync_error_message = NULL,
    sync_attempt_count = 0
WHERE quantity_approved = 0 
  AND quantity_defective = 0 
  AND synced_to_shopify = true;