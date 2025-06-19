
-- Primero, verificar que el trigger existe y está activo
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_order_completion';

-- Verificar el estado actual de los delivery_items para la orden ORD-0009
SELECT 
    di.id,
    di.delivery_id,
    d.tracking_number,
    di.quality_status,
    di.quantity_delivered,
    di.notes,
    d.order_id
FROM delivery_items di
INNER JOIN deliveries d ON di.delivery_id = d.id
WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0009')
ORDER BY d.tracking_number;

-- Verificar el estado de la orden
SELECT id, order_number, status FROM orders WHERE order_number = 'ORD-0009';

-- Recrear el trigger para asegurar que funcione correctamente
DROP TRIGGER IF EXISTS trigger_update_order_completion ON public.delivery_items;

CREATE TRIGGER trigger_update_order_completion
  AFTER INSERT OR UPDATE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status();

-- Actualizar manualmente todos los delivery_items de la orden ORD-0009 que estén en partial_approved
UPDATE delivery_items 
SET quality_status = 'approved',
    notes = CASE 
      WHEN notes IS NOT NULL AND notes NOT LIKE '%[Actualizado automáticamente: Orden completada]%' 
      THEN notes || ' [Actualizado automáticamente: Orden completada]'
      WHEN notes IS NULL 
      THEN '[Actualizado automáticamente: Orden completada]'
      ELSE notes
    END
WHERE delivery_id IN (
  SELECT d.id 
  FROM deliveries d 
  WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0009')
) 
AND quality_status = 'partial_approved';

-- Verificar que los cambios se aplicaron
SELECT 
    di.id,
    di.delivery_id,
    d.tracking_number,
    di.quality_status,
    di.quantity_delivered,
    di.notes
FROM delivery_items di
INNER JOIN deliveries d ON di.delivery_id = d.id
WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0009')
ORDER BY d.tracking_number;
