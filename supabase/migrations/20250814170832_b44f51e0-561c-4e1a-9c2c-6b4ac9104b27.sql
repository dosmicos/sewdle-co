-- Migración de variantes duplicadas de Sleeping Walker Dinosaurios verde TOG 0.5
-- Transferir órdenes y entregas de SKUs incorrectos (SHOPIFY-) a SKUs correctos (numéricos)

-- Función para migrar variantes duplicadas de Sleeping Walker Dinosaurios verde
CREATE OR REPLACE FUNCTION migrate_sleeping_walker_dinosaurios_variants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  product_record RECORD;
  variant_mapping jsonb := '{}';
  incorrect_variant RECORD;
  correct_variant RECORD;
  migration_log jsonb := '{}';
  affected_orders integer := 0;
  affected_deliveries integer := 0;
  affected_sales integer := 0;
  total_migrated integer := 0;
BEGIN
  -- Buscar el producto "Sleeping Walker Dinosaurios verde TOG 0.5"
  SELECT id, name INTO product_record
  FROM public.products 
  WHERE LOWER(name) LIKE '%sleeping%walker%dinosaurios%verde%' 
  AND LOWER(name) LIKE '%tog%0.5%'
  LIMIT 1;
  
  IF product_record.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Producto Sleeping Walker Dinosaurios verde TOG 0.5 no encontrado'
    );
  END IF;
  
  -- Log inicial
  migration_log := jsonb_build_object(
    'product_id', product_record.id,
    'product_name', product_record.name,
    'start_time', now(),
    'migrations', '[]'::jsonb
  );
  
  -- Iterar sobre cada variante incorrecta (que empieza con SHOPIFY-)
  FOR incorrect_variant IN 
    SELECT id, size, color, sku_variant, stock_quantity
    FROM public.product_variants 
    WHERE product_id = product_record.id 
    AND sku_variant LIKE 'SHOPIFY-%'
  LOOP
    -- Buscar la variante correcta correspondiente por talla
    SELECT id, sku_variant INTO correct_variant
    FROM public.product_variants 
    WHERE product_id = product_record.id 
    AND size = incorrect_variant.size
    AND sku_variant NOT LIKE 'SHOPIFY-%'
    AND sku_variant ~ '^[0-9]+$'  -- Solo SKUs numéricos
    LIMIT 1;
    
    IF correct_variant.id IS NOT NULL THEN
      -- Migrar order_items
      UPDATE public.order_items 
      SET product_variant_id = correct_variant.id
      WHERE product_variant_id = incorrect_variant.id;
      
      GET DIAGNOSTICS affected_orders = ROW_COUNT;
      
      -- Migrar sales_metrics
      UPDATE public.sales_metrics 
      SET product_variant_id = correct_variant.id
      WHERE product_variant_id = incorrect_variant.id;
      
      GET DIAGNOSTICS affected_sales = ROW_COUNT;
      
      -- Contar delivery_items afectados (indirectamente a través de order_items)
      SELECT COUNT(*) INTO affected_deliveries
      FROM public.delivery_items di
      JOIN public.order_items oi ON di.order_item_id = oi.id
      WHERE oi.product_variant_id = correct_variant.id;
      
      -- Migrar replenishment_suggestions
      UPDATE public.replenishment_suggestions 
      SET product_variant_id = correct_variant.id
      WHERE product_variant_id = incorrect_variant.id;
      
      -- Migrar replenishment_config
      UPDATE public.replenishment_config 
      SET product_variant_id = correct_variant.id
      WHERE product_variant_id = incorrect_variant.id;
      
      -- Sumar stock de la variante incorrecta a la correcta
      UPDATE public.product_variants 
      SET stock_quantity = stock_quantity + incorrect_variant.stock_quantity
      WHERE id = correct_variant.id;
      
      -- Registrar la migración
      migration_log := jsonb_set(
        migration_log,
        '{migrations}',
        (migration_log->'migrations') || jsonb_build_object(
          'from_variant_id', incorrect_variant.id,
          'from_sku', incorrect_variant.sku_variant,
          'to_variant_id', correct_variant.id,
          'to_sku', correct_variant.sku_variant,
          'size', incorrect_variant.size,
          'orders_migrated', affected_orders,
          'sales_migrated', affected_sales,
          'deliveries_affected', affected_deliveries,
          'stock_transferred', incorrect_variant.stock_quantity
        )
      );
      
      total_migrated := total_migrated + 1;
      
      -- Eliminar la variante incorrecta
      DELETE FROM public.product_variants 
      WHERE id = incorrect_variant.id;
      
    ELSE
      -- Log de variante sin correspondencia
      migration_log := jsonb_set(
        migration_log,
        '{warnings}',
        COALESCE(migration_log->'warnings', '[]'::jsonb) || jsonb_build_object(
          'variant_id', incorrect_variant.id,
          'sku', incorrect_variant.sku_variant,
          'size', incorrect_variant.size,
          'issue', 'No se encontró variante correcta correspondiente'
        )
      );
    END IF;
  END LOOP;
  
  -- Log final
  migration_log := jsonb_set(migration_log, '{end_time}', to_jsonb(now()));
  migration_log := jsonb_set(migration_log, '{total_variants_migrated}', to_jsonb(total_migrated));
  
  -- Insertar log de auditoría
  INSERT INTO public.security_audit_log (
    event_type,
    user_id,
    organization_id,
    event_details
  ) VALUES (
    'variant_migration',
    auth.uid(),
    get_current_organization_safe(),
    migration_log
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'product_name', product_record.name,
    'variants_migrated', total_migrated,
    'migration_details', migration_log
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Ejecutar la migración
SELECT migrate_sleeping_walker_dinosaurios_variants();