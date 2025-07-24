-- SECURITY HARDENING PART 2: Fix remaining database functions with mutable search paths

-- Fix all trigger functions
CREATE OR REPLACE FUNCTION public.update_replenishment_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_status_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.orders 
    SET status = 'assigned', updated_at = now()
    WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.orders 
    SET status = CASE 
      WHEN NEW.status = 'completed' THEN 'completed'
      WHEN NEW.status = 'in_progress' THEN 'in_progress'
      WHEN NEW.status = 'cancelled' THEN 'cancelled'
      ELSE 'assigned'
    END,
    updated_at = now()
    WHERE id = NEW.order_id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_delivery_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  total_items INTEGER;
  synced_items INTEGER;
  delivery_uuid UUID;
BEGIN
  delivery_uuid := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF delivery_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT COUNT(*) INTO total_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid;
  
  SELECT COUNT(*) INTO synced_items
  FROM public.delivery_items 
  WHERE delivery_id = delivery_uuid 
    AND synced_to_shopify = true;
  
  UPDATE public.deliveries 
  SET synced_to_shopify = (synced_items = total_items AND total_items > 0),
      updated_at = now()
  WHERE id = delivery_uuid;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.deliveries WHERE order_id = NEW.order_id AND status != 'approved') = 0 THEN
    UPDATE public.orders SET status = 'completed' WHERE id = NEW.order_id;
  ELSIF NEW.status = 'in_quality' THEN
    UPDATE public.orders SET status = 'in_progress' WHERE id = NEW.order_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_completion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  order_stats RECORD;
  delivery_order_id UUID;
BEGIN
  SELECT d.order_id INTO delivery_order_id
  FROM public.deliveries d
  WHERE d.id = NEW.delivery_id;
  
  IF delivery_order_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats_v2(delivery_order_id);
  
  UPDATE public.orders 
  SET status = CASE 
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 THEN 'in_progress'
    ELSE status
  END,
  updated_at = now()
  WHERE id = delivery_order_id;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_completion_status_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  delivery_order_id UUID;
  order_stats RECORD;
  old_order_status TEXT;
  new_order_status TEXT;
BEGIN
  SELECT d.order_id INTO delivery_order_id
  FROM public.deliveries d
  WHERE d.id = COALESCE(NEW.id, OLD.id);
  
  IF delivery_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT status INTO old_order_status
  FROM public.orders
  WHERE id = delivery_order_id;
  
  SELECT * INTO order_stats 
  FROM public.get_order_delivery_stats_v2(delivery_order_id);
  
  new_order_status := CASE 
    WHEN order_stats.total_delivered = 0 THEN 'pending'
    WHEN order_stats.total_pending = 0 AND order_stats.total_ordered > 0 THEN 'completed'
    WHEN order_stats.total_delivered > 0 AND order_stats.total_pending > 0 THEN 'in_progress'
    ELSE old_order_status
  END;
  
  UPDATE public.orders 
  SET status = new_order_status,
      updated_at = now()
  WHERE id = delivery_order_id
  AND status != 'cancelled';
  
  IF old_order_status != 'completed' AND new_order_status = 'completed' THEN
    UPDATE public.deliveries 
    SET status = 'approved',
        notes = CASE 
          WHEN notes IS NOT NULL AND notes != '' THEN 
            notes || ' [Actualizado automáticamente: Orden completada - Estado cambiado de parcial a aprobado]'
          ELSE 
            'Actualizado automáticamente: Orden completada - Estado cambiado de parcial a aprobado'
        END,
        updated_at = now()
    WHERE order_id = delivery_order_id 
    AND status = 'partial_approved';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_delivery_status_from_items_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  delivery_stats RECORD;
  target_delivery_id UUID;
  total_delivered INTEGER := 0;
  total_approved INTEGER := 0;
  total_defective INTEGER := 0;
  approval_rate NUMERIC := 0;
  new_status TEXT := 'pending';
  new_notes TEXT := '';
BEGIN
  target_delivery_id := COALESCE(NEW.delivery_id, OLD.delivery_id);
  
  IF target_delivery_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT 
    COALESCE(SUM(di.quantity_delivered), 0) as delivered,
    COALESCE(SUM(di.quantity_approved), 0) as approved,
    COALESCE(SUM(di.quantity_defective), 0) as defective
  INTO delivery_stats
  FROM public.delivery_items di
  WHERE di.delivery_id = target_delivery_id;
  
  total_delivered := delivery_stats.delivered;
  total_approved := delivery_stats.approved;
  total_defective := delivery_stats.defective;
  
  IF total_delivered = 0 THEN
    new_status := 'pending';
    new_notes := 'Entrega pendiente: no hay items entregados';
  ELSIF total_delivered > 0 AND (total_approved + total_defective) = 0 THEN
    new_status := 'in_quality';
    new_notes := format('En revisión de calidad: %s items entregados pendientes de revisar', total_delivered);
  ELSIF (total_approved + total_defective) = total_delivered THEN
    IF total_defective = 0 THEN
      new_status := 'approved';
      new_notes := format('Entrega aprobada: %s/%s items aprobados', total_approved, total_delivered);
    ELSIF total_approved = 0 THEN
      new_status := 'rejected';
      new_notes := format('Entrega rechazada: %s/%s items defectuosos', total_defective, total_delivered);
    ELSE
      new_status := 'partial_approved';
      approval_rate := (total_approved::NUMERIC / total_delivered::NUMERIC) * 100;
      new_notes := format('Entrega parcial: %s aprobados, %s defectuosos de %s entregados (%s%% aprobación)', 
        total_approved, total_defective, total_delivered, ROUND(approval_rate, 1));
    END IF;
  ELSIF (total_approved + total_defective) < total_delivered THEN
    new_status := 'in_quality';
    new_notes := format('En revisión: %s aprobados, %s defectuosos, %s pendientes de revisar de %s entregados', 
      total_approved, total_defective, (total_delivered - total_approved - total_defective), total_delivered);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  UPDATE public.deliveries 
  SET status = new_status,
      notes = new_notes,
      updated_at = now()
  WHERE id = target_delivery_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.quantity_delivered > 0 THEN
    UPDATE public.materials 
    SET current_stock = current_stock + NEW.quantity_delivered,
        updated_at = now()
    WHERE id = NEW.material_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'material_deliveries' THEN
    IF OLD.quantity_delivered != NEW.quantity_delivered OR OLD.quantity_consumed != NEW.quantity_consumed THEN
      UPDATE public.materials 
      SET current_stock = current_stock 
        - COALESCE(OLD.quantity_delivered, 0) 
        + COALESCE(NEW.quantity_delivered, 0)
        + COALESCE(OLD.quantity_consumed, 0) 
        - COALESCE(NEW.quantity_consumed, 0),
          updated_at = now()
      WHERE id = NEW.material_id;
    END IF;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' AND OLD.quantity_delivered > 0 THEN
    UPDATE public.materials 
    SET current_stock = current_stock - OLD.quantity_delivered + COALESCE(OLD.quantity_consumed, 0),
        updated_at = now()
    WHERE id = OLD.material_id;
    RETURN OLD;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_sync_zero_quantity_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  delivery_status TEXT;
BEGIN
  SELECT status INTO delivery_status
  FROM public.deliveries 
  WHERE id = NEW.delivery_id;
  
  IF NEW.quantity_approved = 0 AND delivery_status NOT IN ('pending', 'in_quality') THEN
    NEW.synced_to_shopify = true;
    NEW.sync_error_message = 'Auto-sincronizado (cantidad 0)';
    NEW.last_sync_attempt = now();
  END IF;
  
  RETURN NEW;
END;
$function$;