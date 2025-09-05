-- Función para consolidar variantes duplicadas
CREATE OR REPLACE FUNCTION public.consolidate_duplicate_variants()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  duplicate_record RECORD;
  keeper_variant RECORD;
  duplicate_variant RECORD;
  affected_tables jsonb := '{}';
  consolidation_log jsonb := '{"consolidations": []}'::jsonb;
  total_consolidated integer := 0;
BEGIN
  -- Buscar grupos de variantes duplicadas (mismo producto + tamaño + color)
  FOR duplicate_record IN 
    SELECT 
      p.name as product_name,
      p.id as product_id,
      pv.size,
      pv.color,
      COUNT(*) as variant_count,
      ARRAY_AGG(pv.id ORDER BY 
        CASE 
          WHEN pv.sku_variant ~ '^[0-9]+$' THEN 1  -- SKUs numéricos primero
          ELSE 2
        END,
        pv.created_at ASC
      ) as variant_ids,
      ARRAY_AGG(pv.sku_variant ORDER BY 
        CASE 
          WHEN pv.sku_variant ~ '^[0-9]+$' THEN 1
          ELSE 2
        END,
        pv.created_at ASC
      ) as variant_skus
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = get_current_organization_safe()
    GROUP BY p.name, p.id, pv.size, pv.color
    HAVING COUNT(*) > 1
  LOOP
    -- Seleccionar la variante a mantener (preferir SKUs numéricos)
    SELECT * INTO keeper_variant
    FROM product_variants 
    WHERE id = duplicate_record.variant_ids[1];
    
    -- Log de la consolidación
    consolidation_log := jsonb_set(
      consolidation_log,
      '{consolidations}',
      (consolidation_log->'consolidations') || jsonb_build_object(
        'product_name', duplicate_record.product_name,
        'size', duplicate_record.size,
        'color', duplicate_record.color,
        'keeper_sku', keeper_variant.sku_variant,
        'duplicates_removed', array_length(duplicate_record.variant_ids, 1) - 1,
        'duplicate_skus', duplicate_record.variant_skus[2:]
      )
    );
    
    -- Procesar cada variante duplicada
    FOR i IN 2..array_length(duplicate_record.variant_ids, 1) LOOP
      SELECT * INTO duplicate_variant
      FROM product_variants 
      WHERE id = duplicate_record.variant_ids[i];
      
      -- 1. Migrar order_items
      UPDATE order_items 
      SET product_variant_id = keeper_variant.id
      WHERE product_variant_id = duplicate_variant.id;
      
      -- 2. Migrar sales_metrics
      UPDATE sales_metrics 
      SET product_variant_id = keeper_variant.id
      WHERE product_variant_id = duplicate_variant.id;
      
      -- 3. Migrar replenishment_suggestions
      UPDATE replenishment_suggestions 
      SET product_variant_id = keeper_variant.id
      WHERE product_variant_id = duplicate_variant.id;
      
      -- 4. Migrar replenishment_config
      UPDATE replenishment_config 
      SET product_variant_id = keeper_variant.id
      WHERE product_variant_id = duplicate_variant.id;
      
      -- 5. Consolidar stock
      UPDATE product_variants 
      SET stock_quantity = stock_quantity + duplicate_variant.stock_quantity
      WHERE id = keeper_variant.id;
      
      -- 6. Eliminar la variante duplicada
      DELETE FROM product_variants 
      WHERE id = duplicate_variant.id;
      
      total_consolidated := total_consolidated + 1;
    END LOOP;
  END LOOP;
  
  -- Insertar log de auditoría
  INSERT INTO security_audit_log (
    event_type,
    user_id,
    organization_id,
    event_details
  ) VALUES (
    'variant_consolidation',
    auth.uid(),
    get_current_organization_safe(),
    consolidation_log
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'variants_consolidated', total_consolidated,
    'consolidation_details', consolidation_log
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$function$;

-- Función para encontrar duplicados antes de asignar SKUs
CREATE OR REPLACE FUNCTION public.find_matching_local_variant(
  p_product_name text,
  p_size text,
  p_color text,
  p_organization_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pv.id
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.organization_id = p_organization_id
    AND LOWER(p.name) = LOWER(p_product_name)
    AND COALESCE(LOWER(pv.size), '') = COALESCE(LOWER(p_size), '')
    AND COALESCE(LOWER(pv.color), '') = COALESCE(LOWER(p_color), '')
  ORDER BY 
    CASE 
      WHEN pv.sku_variant ~ '^[0-9]+$' THEN 1  -- Preferir SKUs numéricos
      ELSE 2
    END,
    pv.created_at ASC
  LIMIT 1;
$function$;