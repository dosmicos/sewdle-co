-- Corregir el estado de sincronización de todas las entregas exitosamente sincronizadas
-- Estas entregas fueron sincronizadas pero el estado no se actualizó correctamente

UPDATE deliveries 
SET synced_to_shopify = true,
    updated_at = now()
WHERE synced_to_shopify = false
AND EXISTS (
  SELECT 1 FROM inventory_sync_logs isl 
  WHERE isl.delivery_id = deliveries.id 
  AND isl.success_count > 0 
  AND isl.error_count = 0
);