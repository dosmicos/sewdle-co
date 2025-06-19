
-- Verificar el estado actual de la orden ORD-0010
SELECT id, order_number, status 
FROM orders 
WHERE order_number = 'ORD-0010';

-- Verificar las entregas de esta orden que están en partial_approved
SELECT 
  d.tracking_number,
  d.status as delivery_status,
  di.quality_status,
  di.notes
FROM deliveries d
INNER JOIN delivery_items di ON d.id = di.delivery_id
WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0010')
AND di.quality_status = 'partial_approved';

-- Actualizar manualmente las entregas parcialmente aprobadas de la orden ORD-0010 a aprobadas
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
  WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0010')
) 
AND quality_status = 'partial_approved';

-- Verificar que los cambios se aplicaron
SELECT 
  d.tracking_number,
  d.status as delivery_status,
  di.quality_status,
  di.notes
FROM deliveries d
INNER JOIN delivery_items di ON d.id = di.delivery_id
WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0010')
ORDER BY d.tracking_number;

-- También buscar y corregir todas las demás órdenes completadas que tengan entregas parcialmente aprobadas
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
  INNER JOIN orders o ON d.order_id = o.id
  WHERE o.status = 'completed'
) 
AND quality_status = 'partial_approved';
