-- Limpiar triggers antiguos que están causando conflictos
-- Eliminar triggers obsoletos de delivery_items
DROP TRIGGER IF EXISTS trigger_update_delivery_status ON delivery_items;
DROP TRIGGER IF EXISTS trigger_update_order_completion ON delivery_items;
DROP TRIGGER IF EXISTS update_delivery_status_trigger ON delivery_items;
DROP TRIGGER IF EXISTS update_order_status_trigger ON delivery_items;

-- Eliminar funciones obsoletas
DROP FUNCTION IF EXISTS public.update_order_completion_status();
DROP FUNCTION IF EXISTS public.update_delivery_status_from_items();

-- Crear triggers simplificados y funcionales
-- Trigger para actualizar estado de entrega cuando cambian los delivery_items
CREATE OR REPLACE TRIGGER update_delivery_status_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_status_from_items_v2();

-- Trigger para actualizar estado de orden cuando cambia el estado de una entrega
CREATE OR REPLACE TRIGGER update_order_status_on_delivery_change
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status_v2();