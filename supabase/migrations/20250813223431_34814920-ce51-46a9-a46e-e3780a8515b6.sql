-- Fix all remaining functions without SET search_path to complete security hardening

-- Query and fix all remaining critical functions
CREATE OR REPLACE FUNCTION public.get_workshop_capacity_stats()
 RETURNS TABLE(workshop_id uuid, workshop_name text, total_capacity integer, current_assignments bigint, available_capacity integer, completion_rate numeric)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    w.id as workshop_id,
    w.name as workshop_name,
    COALESCE(w.capacity, 0) as total_capacity,
    COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress')) as current_assignments,
    GREATEST(0, COALESCE(w.capacity, 0) - COUNT(wa.id) FILTER (WHERE wa.status IN ('assigned', 'in_progress'))) as available_capacity,
    CASE 
      WHEN COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled')) > 0 
      THEN ROUND(
        (COUNT(wa.id) FILTER (WHERE wa.status = 'completed')::NUMERIC / 
         COUNT(wa.id) FILTER (WHERE wa.status IN ('completed', 'cancelled'))::NUMERIC) * 100, 
        2
      )
      ELSE 0
    END as completion_rate
  FROM workshops w
  LEFT JOIN workshop_assignments wa ON w.id = wa.workshop_id
  WHERE w.status = 'active'
  GROUP BY w.id, w.name, w.capacity
  ORDER BY w.name;
$function$;

CREATE OR REPLACE FUNCTION public.get_available_orders()
 RETURNS TABLE(id uuid, order_number text, client_name text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.client_name,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
 RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    d.id,
    d.tracking_number,
    d.order_id,
    o.order_number,
    d.workshop_id,
    w.name as workshop_name,
    d.delivery_date,
    d.status,
    d.delivered_by,
    p.name as delivered_by_name,
    d.recipient_name,
    d.recipient_phone,
    d.recipient_address,
    d.notes,
    d.created_at,
    COUNT(di.id) as items_count,
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity
  FROM deliveries d
  LEFT JOIN orders o ON d.order_id = o.id
  LEFT JOIN workshops w ON d.workshop_id = w.id
  LEFT JOIN profiles p ON d.delivered_by = p.id
  LEFT JOIN delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_workshop_material_stock(material_id_param uuid, workshop_id_param uuid)
 RETURNS TABLE(available_stock numeric, total_delivered numeric, total_consumed numeric)
 LANGUAGE sql
 STABLE
 SET search_path = 'public'
AS $function$
  SELECT 
    -- Balance real = entregado - consumido (mantener decimales, asegurar que nunca sea negativo)
    GREATEST(0, COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0)) as available_stock,
    -- Total entregado
    COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered,
    -- Total consumido
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed
  FROM public.material_deliveries md
  WHERE md.material_id = material_id_param 
    AND md.workshop_id = workshop_id_param;
$function$;

-- Continue with critical functions
CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  order_uuid UUID;
  has_deliveries BOOLEAN;
BEGIN
  -- Obtener el order_id del trigger
  order_uuid := COALESCE(NEW.order_id, OLD.order_id);
  
  IF order_uuid IS NULL THEN
    -- Si es un delivery_item, obtener order_id desde deliveries
    SELECT d.order_id INTO order_uuid
    FROM public.deliveries d
    WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  END IF;
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Calcular total ordenado
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM public.order_items 
  WHERE order_id = order_uuid;
  
  -- Calcular total aprobado
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM public.delivery_items di
  JOIN public.deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid;
  
  -- Verificar si tiene deliveries
  SELECT EXISTS(SELECT 1 FROM public.deliveries WHERE order_id = order_uuid) INTO has_deliveries;
  
  -- Actualizar estado según unidades y deliveries
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    -- Todas las unidades están aprobadas -> completada
    UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = order_uuid;
  ELSIF has_deliveries THEN
    -- Tiene deliveries pero no todas las unidades están aprobadas -> en progreso
    UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = order_uuid;
  ELSIF EXISTS (SELECT 1 FROM public.workshop_assignments WHERE order_id = order_uuid AND status IN ('assigned', 'in_progress')) THEN
    -- Tiene asignaciones pero no deliveries -> asignada
    UPDATE public.orders SET status = 'assigned', updated_at = now() WHERE id = order_uuid;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_delivery_sync_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

-- Final critical security hardening notification
RAISE NOTICE 'Phase 1 & 2 security fixes completed: ';
RAISE NOTICE '✅ Fixed overly permissive RLS policies on order_supplies and material_deliveries';
RAISE NOTICE '✅ Added search_path security to critical database functions';
RAISE NOTICE '✅ Created security audit logging system';
RAISE NOTICE '⚠️  Remaining: 30+ functions still need search_path fixes (see linter warnings)';
RAISE NOTICE '⚠️  Auth OTP expiry and password protection settings need manual configuration';