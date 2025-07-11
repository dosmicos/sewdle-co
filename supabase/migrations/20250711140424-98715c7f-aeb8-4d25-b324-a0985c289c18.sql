-- Corregir el estado de sincronización de DEL-0001
-- Esta entrega fue sincronizada exitosamente el 2025-07-03 pero el estado no se actualizó

UPDATE deliveries 
SET synced_to_shopify = true,
    updated_at = now()
WHERE tracking_number = 'DEL-0001'
AND EXISTS (
  SELECT 1 FROM inventory_sync_logs isl 
  WHERE isl.delivery_id = deliveries.id 
  AND isl.success_count > 0 
  AND isl.error_count = 0
);