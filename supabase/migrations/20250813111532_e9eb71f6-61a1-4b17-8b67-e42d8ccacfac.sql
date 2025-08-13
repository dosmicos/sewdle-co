-- Corregir el estado de sincronización de delivery_items de DEL-0068
-- Marcar como sincronizados los items que ya se sincronizaron exitosamente según los logs

-- Actualizar delivery_items que se sincronizaron exitosamente
WITH successful_skus AS (
  SELECT DISTINCT 
    (result->>'sku')::text as sku
  FROM inventory_sync_logs isl,
       jsonb_array_elements(isl.sync_results->'results') as result
  WHERE isl.delivery_id = (SELECT id FROM deliveries WHERE tracking_number = 'DEL-0068')
  AND isl.success_count > 0
  AND isl.verification_status = 'verified'
  AND result->>'status' = 'success'
)
UPDATE delivery_items 
SET synced_to_shopify = true,
    sync_error_message = NULL,
    sync_attempt_count = 0,
    last_sync_attempt = now()
WHERE id IN (
  SELECT di.id
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  JOIN order_items oi ON di.order_item_id = oi.id
  JOIN product_variants pv ON oi.product_variant_id = pv.id
  WHERE d.tracking_number = 'DEL-0068'
  AND pv.sku_variant IN (SELECT sku FROM successful_skus)
);

-- Actualizar el estado general de la entrega DEL-0068
-- Verificar si todos los items están sincronizados
UPDATE deliveries 
SET synced_to_shopify = (
  SELECT CASE 
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE di.synced_to_shopify = true) THEN true
    ELSE false
  END
  FROM delivery_items di
  WHERE di.delivery_id = deliveries.id
),
sync_error_message = NULL,
sync_attempts = 0,
last_sync_attempt = now(),
updated_at = now()
WHERE tracking_number = 'DEL-0068';