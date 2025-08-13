-- Corregir el problema de SKU duplicado para Ruana Pony talla 12 - Versión completa
-- SKU incorrecto: 45877550776555 (no existe en Shopify)
-- SKU correcto: 46562538651883 (existe en Shopify)

-- Paso 1: Migrar order_items que usan el SKU incorrecto al SKU correcto
UPDATE order_items 
SET product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '46562538651883'
  LIMIT 1
)
WHERE product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '45877550776555'
  LIMIT 1
);

-- Paso 2: Migrar replenishment_suggestions
UPDATE replenishment_suggestions
SET product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '46562538651883'
  LIMIT 1
)
WHERE product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '45877550776555'
  LIMIT 1
);

-- Paso 3: Migrar replenishment_config si existe
UPDATE replenishment_config
SET product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '46562538651883'
  LIMIT 1
)
WHERE product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '45877550776555'
  LIMIT 1
);

-- Paso 4: Migrar sales_metrics si existe
UPDATE sales_metrics
SET product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '46562538651883'
  LIMIT 1
)
WHERE product_variant_id = (
  SELECT id FROM product_variants 
  WHERE sku_variant = '45877550776555'
  LIMIT 1
);

-- Paso 5: Ahora eliminar la variante incorrecta (45877550776555)
DELETE FROM product_variants 
WHERE sku_variant = '45877550776555';

-- Paso 6: Limpiar estados de sincronización problemáticos
-- Resetear el estado de sincronización de las entregas afectadas para que se reintenten
UPDATE deliveries 
SET synced_to_shopify = false,
    sync_error_message = NULL,
    sync_attempts = 0,
    last_sync_attempt = NULL,
    updated_at = now()
WHERE sync_error_message LIKE '%45877550776555%';

-- Paso 7: Resetear estado de sincronización de delivery_items afectados
UPDATE delivery_items 
SET synced_to_shopify = false,
    sync_error_message = NULL,
    sync_attempt_count = 0,
    last_sync_attempt = NULL
WHERE delivery_id IN (
  SELECT id FROM deliveries 
  WHERE sync_error_message LIKE '%45877550776555%'
  OR id IN (
    SELECT DISTINCT d.id 
    FROM deliveries d
    JOIN delivery_items di ON d.id = di.delivery_id
    JOIN order_items oi ON di.order_item_id = oi.id
    JOIN product_variants pv ON oi.product_variant_id = pv.id
    WHERE pv.sku_variant = '46562538651883'
  )
);

-- Paso 8: Log de la corrección realizada
INSERT INTO sync_control_logs (
  sync_type,
  sync_mode,
  status,
  start_time,
  end_time,
  execution_details
) VALUES (
  'sku_correction',
  'manual',
  'completed',
  now(),
  now(),
  jsonb_build_object(
    'action', 'duplicate_sku_cleanup_complete',
    'removed_sku', '45877550776555',
    'migrated_to_sku', '46562538651883',
    'tables_updated', ARRAY['order_items', 'replenishment_suggestions', 'replenishment_config', 'sales_metrics', 'deliveries', 'delivery_items'],
    'description', 'Complete migration from incorrect SKU to correct Shopify SKU for Ruana Pony talla 12'
  )
);