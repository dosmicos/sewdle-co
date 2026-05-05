-- FASE 1: Corregir función refresh_inventory_replenishment
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id;
  
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    calculated_at
  )
  SELECT 
    org_id,
    pv.id,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(
      (SELECT SUM(oi.quantity)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id 
       AND o.status IN ('pending', 'assigned', 'in_progress')
       AND o.organization_id = org_id),
      0
    ),
    COALESCE(
      (SELECT SUM(oi.quantity)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ),
    COALESCE(
      (SELECT COUNT(DISTINCT o.id)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ),
    CASE 
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
      THEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0
      ELSE 0
    END,
    CASE 
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
      THEN COALESCE(pv.stock_quantity, 0) / 
           ((SELECT SUM(oi.quantity)
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE oi.product_variant_id = pv.id
             AND o.organization_id = org_id
             AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0)
      ELSE 999
    END,
    COALESCE(
      (SELECT SUM(oi.quantity)
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_variant_id = pv.id
       AND o.organization_id = org_id
       AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ),
    GREATEST(0, 
      COALESCE(
        (SELECT SUM(oi.quantity)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_variant_id = pv.id
         AND o.organization_id = org_id
         AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) - COALESCE(pv.stock_quantity, 0)
    ),
    CASE 
      WHEN COALESCE(pv.stock_quantity, 0) = 0 THEN 'critical'
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
           AND COALESCE(pv.stock_quantity, 0) / 
               ((SELECT SUM(oi.quantity)
                 FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 WHERE oi.product_variant_id = pv.id
                 AND o.organization_id = org_id
                 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0) < 7 
      THEN 'high'
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
           AND COALESCE(pv.stock_quantity, 0) / 
               ((SELECT SUM(oi.quantity)
                 FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 WHERE oi.product_variant_id = pv.id
                 AND o.organization_id = org_id
                 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0) < 15 
      THEN 'medium'
      ELSE 'low'
    END,
    CASE 
      WHEN COALESCE(pv.stock_quantity, 0) = 0 THEN 'Sin stock disponible'
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
           AND COALESCE(pv.stock_quantity, 0) / 
               ((SELECT SUM(oi.quantity)
                 FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 WHERE oi.product_variant_id = pv.id
                 AND o.organization_id = org_id
                 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0) < 7 
      THEN 'Stock bajo - menos de 1 semana'
      WHEN (SELECT SUM(oi.quantity)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') > 0 
           AND COALESCE(pv.stock_quantity, 0) / 
               ((SELECT SUM(oi.quantity)
                 FROM order_items oi
                 JOIN orders o ON oi.order_id = o.id
                 WHERE oi.product_variant_id = pv.id
                 AND o.organization_id = org_id
                 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') / 30.0) < 15 
      THEN 'Stock medio - menos de 2 semanas'
      ELSE 'Stock suficiente'
    END,
    CASE
      WHEN (SELECT COUNT(DISTINCT o.id)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') >= 5 
      THEN 'high'
      WHEN (SELECT COUNT(DISTINCT o.id)
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days') >= 2 
      THEN 'medium'
      ELSE 'low'
    END,
    now()
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.organization_id = org_id
    AND p.status = 'active';

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted
  );
END;
$$;

-- FASE 2: Actualizar funciones que referencian tablas viejas
DROP FUNCTION IF EXISTS check_variant_update_safety(uuid, text);
CREATE OR REPLACE FUNCTION check_variant_update_safety(variant_id_param uuid, new_sku_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_sku text;
  references_info jsonb := '{}';
  pending_deliveries integer := 0;
  warnings text[] := ARRAY[]::text[];
BEGIN
  SELECT sku_variant INTO current_sku
  FROM product_variants
  WHERE id = variant_id_param;
  
  IF current_sku IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;
  
  IF new_sku_param != current_sku AND EXISTS (
    SELECT 1 FROM product_variants 
    WHERE sku_variant = new_sku_param AND id != variant_id_param
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU already exists', 'conflicting_sku', new_sku_param);
  END IF;
  
  references_info := jsonb_build_object(
    'order_items', (SELECT COUNT(*) FROM order_items WHERE product_variant_id = variant_id_param),
    'inventory_replenishment', (SELECT COUNT(*) FROM inventory_replenishment WHERE variant_id = variant_id_param)
  );
  
  SELECT COUNT(*) INTO pending_deliveries
  FROM delivery_items di
  JOIN deliveries d ON di.delivery_id = d.id
  JOIN order_items oi ON di.order_item_id = oi.id
  WHERE oi.product_variant_id = variant_id_param AND d.synced_to_shopify = false;
  
  IF pending_deliveries > 0 THEN
    warnings := array_append(warnings, format('Hay %s entregas pendientes de sincronizar', pending_deliveries));
  END IF;
  
  IF (references_info->>'order_items')::integer > 0 THEN
    warnings := array_append(warnings, format('Referenciada en %s órdenes', references_info->>'order_items'));
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 'current_sku', current_sku, 'new_sku', new_sku_param,
    'references', references_info, 'pending_deliveries', pending_deliveries,
    'warnings', warnings, 'can_update', true, 'requires_confirmation', array_length(warnings, 1) > 0
  );
END;
$$;

DROP FUNCTION IF EXISTS update_variant_sku_cascade(uuid, text);
CREATE OR REPLACE FUNCTION update_variant_sku_cascade(variant_id_param uuid, new_sku_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  old_sku text;
  affected_tables jsonb := '{}';
BEGIN
  SELECT sku_variant INTO old_sku FROM product_variants WHERE id = variant_id_param;
  
  IF old_sku IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;
  
  IF EXISTS (SELECT 1 FROM product_variants WHERE sku_variant = new_sku_param AND id != variant_id_param) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SKU already exists', 'conflicting_sku', new_sku_param);
  END IF;
  
  UPDATE product_variants SET sku_variant = new_sku_param, updated_at = now() WHERE id = variant_id_param;
  
  affected_tables := jsonb_build_object(
    'delivery_items', (SELECT COUNT(*) FROM delivery_items di JOIN order_items oi ON di.order_item_id = oi.id WHERE oi.product_variant_id = variant_id_param),
    'order_items', (SELECT COUNT(*) FROM order_items WHERE product_variant_id = variant_id_param),
    'inventory_replenishment', (SELECT COUNT(*) FROM inventory_replenishment WHERE variant_id = variant_id_param)
  );
  
  RETURN jsonb_build_object(
    'success', true, 'old_sku', old_sku, 'new_sku', new_sku_param,
    'variant_id', variant_id_param, 'affected_tables', affected_tables,
    'message', 'SKU actualizado exitosamente'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'error_code', SQLSTATE);
END;
$$;

-- FASE 3: Eliminar sistema viejo
DROP FUNCTION IF EXISTS get_replenishment_suggestions_with_details();
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);
DROP TABLE IF EXISTS replenishment_suggestions CASCADE;
DROP TABLE IF EXISTS sales_metrics CASCADE;
DROP TABLE IF EXISTS replenishment_config CASCADE;