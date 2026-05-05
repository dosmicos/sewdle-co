
-- Function to sync UGC campaign status when picking order status changes
CREATE OR REPLACE FUNCTION public.sync_ugc_campaign_from_picking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when operational_status changes to ready_to_ship or shipped
  IF NEW.operational_status IN ('ready_to_ship', 'shipped')
     AND (OLD.operational_status IS NULL OR OLD.operational_status != NEW.operational_status)
     AND NEW.order_number IS NOT NULL
     AND NEW.order_number != '' THEN

    UPDATE public.ugc_campaigns
    SET status = 'producto_enviado',
        updated_at = NOW()
    WHERE REPLACE(order_number, '#', '') = REPLACE(NEW.order_number, '#', '')
      AND organization_id = NEW.organization_id
      AND status IN ('contactado', 'negociando', 'aceptado');

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on picking_packing_orders
CREATE TRIGGER sync_ugc_campaign_from_picking
  AFTER UPDATE ON public.picking_packing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ugc_campaign_from_picking();
