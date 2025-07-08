-- Crear trigger para actualizar automáticamente el estado de las entregas cuando se actualizan los delivery_items
CREATE OR REPLACE TRIGGER update_delivery_status_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_status_from_items_v2();

-- También crear trigger para actualizar el estado de la orden cuando cambia el estado de una entrega
CREATE OR REPLACE TRIGGER update_order_status_on_delivery_change
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_completion_status_v2();