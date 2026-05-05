-- Sync UGC campaign status from shipping label delivery updates
CREATE OR REPLACE FUNCTION public.sync_ugc_campaign_from_shipping_labels()
RETURNS TRIGGER AS $$
DECLARE
  normalized_order TEXT;
BEGIN
  IF NEW.order_number IS NULL OR btrim(NEW.order_number) = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      normalized_order := REPLACE(NEW.order_number, '#', '');

      UPDATE public.ugc_campaigns
      SET status = 'producto_recibido',
          tracking_number = COALESCE(tracking_number, NEW.tracking_number),
          received_date = COALESCE(received_date, CURRENT_DATE),
          updated_at = NOW()
      WHERE organization_id = NEW.organization_id
        AND REPLACE(order_number, '#', '') = normalized_order
        AND status IN ('contactado', 'negociando', 'aceptado', 'producto_enviado');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_ugc_campaign_from_shipping_labels ON public.shipping_labels;
CREATE TRIGGER sync_ugc_campaign_from_shipping_labels
  AFTER INSERT OR UPDATE ON public.shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ugc_campaign_from_shipping_labels();

-- Keep ugc_creators.status aligned with campaign progression
CREATE OR REPLACE FUNCTION public.recalculate_ugc_creator_status(
  p_creator_id UUID,
  p_organization_id UUID
)
RETURNS VOID AS $$
DECLARE
  has_active BOOLEAN := false;
  has_negotiating BOOLEAN := false;
  has_contacted BOOLEAN := false;
  next_status TEXT;
BEGIN
  SELECT
    COALESCE(BOOL_OR(status IN ('aceptado', 'producto_enviado', 'producto_recibido', 'video_en_revision', 'video_aprobado', 'publicado', 'completado')), false),
    COALESCE(BOOL_OR(status = 'negociando'), false),
    COALESCE(BOOL_OR(status = 'contactado'), false)
  INTO has_active, has_negotiating, has_contacted
  FROM public.ugc_campaigns
  WHERE creator_id = p_creator_id
    AND organization_id = p_organization_id;

  IF has_active THEN
    next_status := 'activo';
  ELSIF has_negotiating THEN
    next_status := 'negociando';
  ELSIF has_contacted THEN
    next_status := 'contactado';
  ELSE
    next_status := NULL;
  END IF;

  IF next_status IS NOT NULL THEN
    UPDATE public.ugc_creators
    SET status = next_status,
        updated_at = NOW()
    WHERE id = p_creator_id
      AND organization_id = p_organization_id
      AND status IS DISTINCT FROM next_status;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.sync_ugc_creator_status_from_campaigns()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_ugc_creator_status(NEW.creator_id, NEW.organization_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalculate_ugc_creator_status(NEW.creator_id, NEW.organization_id);
    IF OLD.creator_id IS DISTINCT FROM NEW.creator_id
      OR OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      PERFORM public.recalculate_ugc_creator_status(OLD.creator_id, OLD.organization_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_ugc_creator_status(OLD.creator_id, OLD.organization_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_ugc_creator_status_from_campaigns ON public.ugc_campaigns;
CREATE TRIGGER sync_ugc_creator_status_from_campaigns
  AFTER INSERT OR UPDATE OR DELETE ON public.ugc_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ugc_creator_status_from_campaigns();

-- Backfill already delivered shipments to UGC campaign status
UPDATE public.ugc_campaigns c
SET status = 'producto_recibido',
    tracking_number = COALESCE(c.tracking_number, sl.tracking_number),
    received_date = COALESCE(c.received_date, CURRENT_DATE),
    updated_at = NOW()
FROM public.shipping_labels sl
WHERE c.organization_id = sl.organization_id
  AND REPLACE(c.order_number, '#', '') = REPLACE(sl.order_number, '#', '')
  AND sl.status = 'delivered'
  AND c.status IN ('contactado', 'negociando', 'aceptado', 'producto_enviado');

-- Backfill creator status from current campaign state
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT creator_id, organization_id
    FROM public.ugc_campaigns
  LOOP
    PERFORM public.recalculate_ugc_creator_status(rec.creator_id, rec.organization_id);
  END LOOP;
END;
$$;
