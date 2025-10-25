-- Crear función que mapea tags de Shopify a operational_status
CREATE OR REPLACE FUNCTION map_shopify_tags_to_operational_status(tags TEXT)
RETURNS TEXT AS $$
DECLARE
  tags_lower TEXT;
  current_status TEXT;
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crear función trigger que sincroniza operational_status cuando tags cambian
CREATE OR REPLACE FUNCTION sync_picking_status_from_shopify_tags()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Crear trigger en shopify_orders
DROP TRIGGER IF EXISTS trigger_sync_picking_status_from_tags ON shopify_orders;

CREATE TRIGGER trigger_sync_picking_status_from_tags
  AFTER UPDATE OF tags ON shopify_orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_picking_status_from_shopify_tags();

-- Comentarios para documentación
COMMENT ON FUNCTION map_shopify_tags_to_operational_status IS 
  'Mapea tags de Shopify a operational_status para picking_packing_orders. 
   Tags "empacado" -> packing, "confirmado" -> pending';

COMMENT ON FUNCTION sync_picking_status_from_shopify_tags IS 
  'Trigger function que sincroniza automáticamente operational_status en picking_packing_orders 
   cuando los tags de shopify_orders cambian';

COMMENT ON TRIGGER trigger_sync_picking_status_from_tags ON shopify_orders IS 
  'Sincroniza automáticamente el estado operacional de picking & packing cuando cambian los tags en Shopify';