-- Corregir función map_shopify_tags_to_operational_status con search_path seguro
CREATE OR REPLACE FUNCTION map_shopify_tags_to_operational_status(tags TEXT)
RETURNS TEXT 
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  tags_lower TEXT;
BEGIN
  -- Si no hay tags, retornar pending
  IF tags IS NULL OR tags = '' THEN
    RETURN 'pending';
  END IF;
  
  tags_lower := LOWER(TRIM(tags));
  
  -- Prioridad 1: EMPACADO (sobreescribe estados excepto shipped)
  IF tags_lower LIKE '%empacado%' THEN
    RETURN 'packing';
  END IF;
  
  -- Prioridad 2: Confirmado (debe aparecer en "No preparados")
  IF tags_lower LIKE '%confirmado%' THEN
    RETURN 'pending';
  END IF;
  
  -- Por defecto, no cambiar el estado actual
  RETURN NULL; -- NULL significa "no cambiar"
END;
$$;

-- Corregir función sync_picking_status_from_shopify_tags con search_path seguro
CREATE OR REPLACE FUNCTION sync_picking_status_from_shopify_tags()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  new_operational_status TEXT;
BEGIN
  -- Solo proceder si los tags han cambiado
  IF OLD.tags IS DISTINCT FROM NEW.tags THEN
    -- Obtener el nuevo status basado en los tags
    new_operational_status := map_shopify_tags_to_operational_status(NEW.tags);
    
    -- Si la función retorna NULL, significa que no hay cambio
    IF new_operational_status IS NOT NULL THEN
      -- Actualizar picking_packing_orders con el nuevo status
      UPDATE picking_packing_orders
      SET 
        operational_status = new_operational_status::TEXT,
        updated_at = NOW()
      WHERE 
        shopify_order_id = NEW.shopify_order_id 
        AND organization_id = NEW.organization_id
        -- No actualizar si ya está shipped (estado final)
        AND operational_status != 'shipped';
      
      -- Log para debugging
      RAISE NOTICE 'Tags cambiaron para orden %: % -> %. Nuevo status: %', 
        NEW.order_number, 
        OLD.tags, 
        NEW.tags, 
        new_operational_status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;