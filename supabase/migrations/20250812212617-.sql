-- Function to update product variant SKU with cascading updates
CREATE OR REPLACE FUNCTION public.update_variant_sku_cascade(
  variant_id_param uuid,
  new_sku_param text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_sku text;
  affected_tables jsonb := '{}';
  result_summary jsonb;
BEGIN
  -- Get current SKU
  SELECT sku_variant INTO old_sku
  FROM product_variants
  WHERE id = variant_id_param;
  
  IF old_sku IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
    );
  END IF;
  
  -- Check if new SKU already exists
  IF EXISTS (
    SELECT 1 FROM product_variants 
    WHERE sku_variant = new_sku_param 
    AND id != variant_id_param
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SKU already exists',
      'conflicting_sku', new_sku_param
    );
  END IF;
  
  -- Start transaction for cascading updates
  -- Update the variant itself
  UPDATE product_variants
  SET sku_variant = new_sku_param,
      updated_at = now()
  WHERE id = variant_id_param;
  
  -- Track affected records in delivery_items (if they reference sku_variant)
  -- Note: delivery_items doesn't directly store SKU, but we track for information
  affected_tables := jsonb_set(
    affected_tables,
    '{delivery_items}',
    (SELECT COUNT(*)::text::jsonb FROM delivery_items di 
     JOIN order_items oi ON di.order_item_id = oi.id
     WHERE oi.product_variant_id = variant_id_param)
  );
  
  -- Track affected records in order_items
  affected_tables := jsonb_set(
    affected_tables,
    '{order_items}',
    (SELECT COUNT(*)::text::jsonb FROM order_items
     WHERE product_variant_id = variant_id_param)
  );
  
  -- Track affected records in replenishment_suggestions
  affected_tables := jsonb_set(
    affected_tables,
    '{replenishment_suggestions}',
    (SELECT COUNT(*)::text::jsonb FROM replenishment_suggestions
     WHERE product_variant_id = variant_id_param)
  );
  
  -- Track affected records in replenishment_config
  affected_tables := jsonb_set(
    affected_tables,
    '{replenishment_config}',
    (SELECT COUNT(*)::text::jsonb FROM replenishment_config
     WHERE product_variant_id = variant_id_param)
  );
  
  -- Track affected records in sales_metrics
  affected_tables := jsonb_set(
    affected_tables,
    '{sales_metrics}',
    (SELECT COUNT(*)::text::jsonb FROM sales_metrics
     WHERE product_variant_id = variant_id_param)
  );
  
  result_summary := jsonb_build_object(
    'success', true,
    'old_sku', old_sku,
    'new_sku', new_sku_param,
    'variant_id', variant_id_param,
    'affected_tables', affected_tables,
    'message', 'SKU updated successfully with cascading references tracked'
  );
  
  RETURN result_summary;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Function to check if a variant can be safely updated
CREATE OR REPLACE FUNCTION public.check_variant_update_safety(
  variant_id_param uuid,
  new_sku_param text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_sku text;
  references_info jsonb := '{}';
  pending_deliveries integer := 0;
  warnings text[] := ARRAY[]::text[];
BEGIN
  -- Get current SKU
  SELECT sku_variant INTO current_sku
  FROM product_variants
  WHERE id = variant_id_param;
  
  IF current_sku IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
    );
  END IF;
  
  -- Check if new SKU already exists
  IF new_sku_param != current_sku AND EXISTS (
    SELECT 1 FROM product_variants 
    WHERE sku_variant = new_sku_param 
    AND id != variant_id_param
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SKU already exists',
      'conflicting_sku', new_sku_param
    );
  END IF;
  
  -- Check references in various tables
  references_info := jsonb_build_object(
    'order_items', (
      SELECT COUNT(*) FROM order_items
      WHERE product_variant_id = variant_id_param
    ),
    'replenishment_suggestions', (
      SELECT COUNT(*) FROM replenishment_suggestions
      WHERE product_variant_id = variant_id_param
    ),
    'replenishment_config', (
      SELECT COUNT(*) FROM replenishment_config
      WHERE product_variant_id = variant_id_param
    ),
    'sales_metrics', (
      SELECT COUNT(*) FROM sales_metrics
      WHERE product_variant_id = variant_id_param
    )
  );
  
  -- Check for pending deliveries that might affect Shopify sync
  SELECT COUNT(*) INTO pending_deliveries
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  JOIN order_items oi ON di.order_item_id = oi.id
  WHERE oi.product_variant_id = variant_id_param
  AND d.synced_to_shopify = false;
  
  -- Generate warnings
  IF pending_deliveries > 0 THEN
    warnings := array_append(warnings, 
      format('Hay %s entregas pendientes de sincronizar con Shopify que usan esta variante', pending_deliveries)
    );
  END IF;
  
  IF (references_info->>'order_items')::integer > 0 THEN
    warnings := array_append(warnings,
      format('Esta variante está referenciada en %s órdenes', references_info->>'order_items')
    );
  END IF;
  
  IF (references_info->>'replenishment_suggestions')::integer > 0 THEN
    warnings := array_append(warnings,
      format('Esta variante tiene %s sugerencias de reposición', references_info->>'replenishment_suggestions')
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'current_sku', current_sku,
    'new_sku', new_sku_param,
    'references', references_info,
    'pending_deliveries', pending_deliveries,
    'warnings', warnings,
    'can_update', true,
    'requires_confirmation', array_length(warnings, 1) > 0
  );
END;
$$;