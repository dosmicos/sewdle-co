
-- Verificar el estado actual de la orden ORD-0009
SELECT id, order_number, status 
FROM orders 
WHERE order_number = 'ORD-0009';

-- Verificar las entregas de esta orden
SELECT 
  d.tracking_number,
  d.status as delivery_status,
  di.quality_status,
  di.notes
FROM deliveries d
INNER JOIN delivery_items di ON d.id = di.delivery_id
WHERE d.order_id = (SELECT id FROM orders WHERE order_number = 'ORD-0009');

-- Verificar las estadísticas de la orden
SELECT * FROM get_order_delivery_stats(
  (SELECT id FROM orders WHERE order_number = 'ORD-0009')
);

-- Forzar la actualización manual para esta orden específica
DO $$
DECLARE
  order_id_var UUID;
  order_stats RECORD;
BEGIN
  -- Obtener el ID de la orden ORD-0009
  SELECT id INTO order_id_var
  FROM orders 
  WHERE order_number = 'ORD-0009';
  
  IF order_id_var IS NOT NULL THEN
    -- Obtener estadísticas
    SELECT * INTO order_stats 
    FROM public.get_order_delivery_stats(order_id_var);
    
    -- Si la orden debería estar completada, actualizarla
    IF order_stats.total_approved >= order_stats.total_ordered AND order_stats.total_pending = 0 THEN
      -- Actualizar estado de la orden
      UPDATE orders 
      SET status = 'completed',
          updated_at = now()
      WHERE id = order_id_var;
      
      -- Actualizar entregas parcialmente aprobadas
      UPDATE delivery_items 
      SET quality_status = 'approved',
          notes = CASE 
            WHEN notes IS NOT NULL THEN notes || ' [Actualizado automáticamente: Orden completada]'
            ELSE '[Actualizado automáticamente: Orden completada]'
          END
      WHERE delivery_id IN (
        SELECT d.id 
        FROM deliveries d 
        WHERE d.order_id = order_id_var
      ) 
      AND quality_status = 'partial_approved';
      
      RAISE NOTICE 'Orden ORD-0009 actualizada correctamente';
    ELSE
      RAISE NOTICE 'Orden ORD-0009 no cumple los criterios para ser completada. Aprobadas: %, Ordenadas: %, Pendientes: %', 
        order_stats.total_approved, order_stats.total_ordered, order_stats.total_pending;
    END IF;
  END IF;
END $$;
