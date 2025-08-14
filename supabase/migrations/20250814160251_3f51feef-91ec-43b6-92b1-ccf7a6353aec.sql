-- Migración de consolidación de productos duplicados
-- Migrar "Sleeping Walker con Mangas Estrellas TOG 2.5" hacia "Sleeping Walker Star con Mangas TOG 2.5"

-- Paso 1: Crear respaldo de seguridad en una tabla temporal
CREATE TEMP TABLE backup_order_items AS 
SELECT * FROM public.order_items 
WHERE product_variant_id IN (
  '661fba7d-f1f8-4139-8d42-a8e0bf0b05de',
  'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81', 
  '179bbb43-e4f7-4a79-ab1b-d21c62a84077'
);

-- Paso 2: Migrar order_items del producto incorrecto al correcto
-- Actualizar variante "2 (12 a 24 meses)"
UPDATE public.order_items 
SET product_variant_id = '885dbf53-0340-4049-879e-e69594a29673'
WHERE product_variant_id = '661fba7d-f1f8-4139-8d42-a8e0bf0b05de';

-- Actualizar variante "4 (24 a 36 meses)"
UPDATE public.order_items 
SET product_variant_id = 'dd6ff0e5-3ed3-410a-8284-6c55ecccd8f3'
WHERE product_variant_id = 'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81';

-- Actualizar variante "6 (3 - 4 años)"
UPDATE public.order_items 
SET product_variant_id = '3495e078-2fdf-4db5-bac5-5793cac0f3f1'
WHERE product_variant_id = '179bbb43-e4f7-4a79-ab1b-d21c62a84077';

-- Paso 3: Migrar sales_metrics si existen
UPDATE public.sales_metrics 
SET product_variant_id = '885dbf53-0340-4049-879e-e69594a29673'
WHERE product_variant_id = '661fba7d-f1f8-4139-8d42-a8e0bf0b05de';

UPDATE public.sales_metrics 
SET product_variant_id = 'dd6ff0e5-3ed3-410a-8284-6c55ecccd8f3'
WHERE product_variant_id = 'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81';

UPDATE public.sales_metrics 
SET product_variant_id = '3495e078-2fdf-4db5-bac5-5793cac0f3f1'
WHERE product_variant_id = '179bbb43-e4f7-4a79-ab1b-d21c62a84077';

-- Paso 4: Migrar replenishment_suggestions si existen
UPDATE public.replenishment_suggestions 
SET product_variant_id = '885dbf53-0340-4049-879e-e69594a29673'
WHERE product_variant_id = '661fba7d-f1f8-4139-8d42-a8e0bf0b05de';

UPDATE public.replenishment_suggestions 
SET product_variant_id = 'dd6ff0e5-3ed3-410a-8284-6c55ecccd8f3'
WHERE product_variant_id = 'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81';

UPDATE public.replenishment_suggestions 
SET product_variant_id = '3495e078-2fdf-4db5-bac5-5793cac0f3f1'
WHERE product_variant_id = '179bbb43-e4f7-4a79-ab1b-d21c62a84077';

-- Paso 5: Migrar replenishment_config si existe
UPDATE public.replenishment_config 
SET product_variant_id = '885dbf53-0340-4049-879e-e69594a29673'
WHERE product_variant_id = '661fba7d-f1f8-4139-8d42-a8e0bf0b05de';

UPDATE public.replenishment_config 
SET product_variant_id = 'dd6ff0e5-3ed3-410a-8284-6c55ecccd8f3'
WHERE product_variant_id = 'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81';

UPDATE public.replenishment_config 
SET product_variant_id = '3495e078-2fdf-4db5-bac5-5793cac0f3f1'
WHERE product_variant_id = '179bbb43-e4f7-4a79-ab1b-d21c62a84077';

-- Paso 6: Eliminar las variantes del producto incorrecto
DELETE FROM public.product_variants 
WHERE id IN (
  '661fba7d-f1f8-4139-8d42-a8e0bf0b05de',
  'bcd7eb39-5d94-48b6-aa7c-4e1751c43e81',
  '179bbb43-e4f7-4a79-ab1b-d21c62a84077'
);

-- Paso 7: Eliminar el producto incorrecto
DELETE FROM public.products 
WHERE id = '7639aba3-3f7d-416b-ab20-0d2f683cdc06';

-- Paso 8: Verificación final - Mostrar resumen de la migración
DO $$
DECLARE
  migrated_orders INTEGER;
  remaining_incorrect_items INTEGER;
BEGIN
  -- Contar órdenes que ahora usan el producto correcto
  SELECT COUNT(DISTINCT oi.order_id) INTO migrated_orders
  FROM public.order_items oi
  JOIN public.product_variants pv ON oi.product_variant_id = pv.id
  WHERE pv.product_id = '2025ce2b-2cae-4305-91f0-264a9e913742';
  
  -- Verificar que no quedan items del producto incorrecto
  SELECT COUNT(*) INTO remaining_incorrect_items
  FROM public.order_items oi
  JOIN public.product_variants pv ON oi.product_variant_id = pv.id
  WHERE pv.product_id = '7639aba3-3f7d-416b-ab20-0d2f683cdc06';
  
  RAISE NOTICE 'Migración completada:';
  RAISE NOTICE '- Órdenes usando producto correcto: %', migrated_orders;
  RAISE NOTICE '- Items pendientes del producto incorrecto: %', remaining_incorrect_items;
  RAISE NOTICE '- Producto duplicado eliminado exitosamente';
END $$;