
-- Eliminar el trigger existente que está causando problemas
DROP TRIGGER IF EXISTS trigger_update_order_status ON public.deliveries;
DROP FUNCTION IF EXISTS public.update_order_status_from_deliveries();

-- Crear una nueva función que funcione correctamente con la tabla deliveries
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verificar si todas las entregas de esta orden están aprobadas
  IF (SELECT COUNT(*) FROM deliveries WHERE order_id = NEW.order_id AND status != 'approved') = 0 THEN
    -- Si todas las entregas están aprobadas, marcar la orden como completada
    UPDATE orders SET status = 'completed', updated_at = now() WHERE id = NEW.order_id;
  ELSIF NEW.status = 'in_quality' THEN
    -- Si hay entregas en calidad, marcar la orden como en progreso
    UPDATE orders SET status = 'in_progress', updated_at = now() WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crear el trigger actualizado
CREATE TRIGGER trigger_update_order_status
  AFTER INSERT OR UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_from_deliveries();
