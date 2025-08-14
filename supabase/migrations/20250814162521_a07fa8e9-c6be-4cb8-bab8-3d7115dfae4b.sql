-- CRITICAL SECURITY FIX: Phase 2D - Fix final batch of Function Security Issues
-- Complete fixing all remaining database functions with missing search_path

CREATE OR REPLACE FUNCTION public.get_material_consumptions_by_order()
RETURNS TABLE(id uuid, material_id uuid, workshop_id uuid, order_id uuid, quantity_consumed numeric, delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone, material_name text, material_unit text, material_category text, material_color text, workshop_name text, order_number text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 
    md.id,
    md.material_id,
    wa.workshop_id,
    md.order_id,
    md.quantity_consumed,
    md.delivery_date,
    md.created_at,
    md.updated_at,
    m.name as material_name,
    m.unit as material_unit,
    m.category as material_category,
    m.color as material_color,
    w.name as workshop_name,
    o.order_number
  FROM public.material_deliveries md
  JOIN public.orders o ON md.order_id = o.id
  JOIN public.workshop_assignments wa ON o.id = wa.order_id
  JOIN public.workshops w ON wa.workshop_id = w.id
  JOIN public.materials m ON md.material_id = m.id
  WHERE md.quantity_consumed > 0
  AND md.order_id IS NOT NULL
  ORDER BY md.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_material_consumption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.quantity_consumed > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.material_deliveries
      WHERE material_id = NEW.material_id
        AND order_id = NEW.order_id
        AND delivery_date = NEW.delivery_date
        AND COALESCE(delivered_by, auth.uid()) = COALESCE(NEW.delivered_by, auth.uid())
        AND quantity_consumed > 0
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Ya existe un registro de consumo para este material, orden y fecha. Por favor, edite el registro existente en lugar de crear uno nuevo.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_sync_in_progress(sync_type_param text, sync_mode_param text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sync_control_logs 
    WHERE sync_type = sync_type_param 
    AND sync_mode = sync_mode_param 
    AND status = 'running'
    AND start_time > now() - INTERVAL '2 hours'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_deliveries_breakdown(order_id_param uuid)
RETURNS TABLE(delivery_id uuid, tracking_number text, delivery_date date, delivery_status text, workshop_name text, items_delivered integer, items_approved integer, items_defective integer, delivery_notes text)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    d.delivery_date,
    d.status as delivery_status,
    w.name as workshop_name,
    COALESCE(SUM(di.quantity_delivered), 0)::INTEGER as items_delivered,
    COALESCE(SUM(di.quantity_approved), 0)::INTEGER as items_approved,
    COALESCE(SUM(di.quantity_defective), 0)::INTEGER as items_defective,
    d.notes as delivery_notes
  FROM public.deliveries d
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  WHERE d.order_id = order_id_param
  GROUP BY d.id, d.tracking_number, d.delivery_date, d.status, w.name, d.notes
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_order_variants_breakdown(order_id_param uuid)
RETURNS TABLE(product_name text, variant_size text, variant_color text, sku_variant text, total_ordered integer, total_approved integer, total_pending integer, completion_percentage numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    oi.quantity::INTEGER as total_ordered,
    COALESCE(SUM(di.quantity_approved), 0)::INTEGER as total_approved,
    GREATEST(0, 
      oi.quantity - COALESCE(SUM(di.quantity_approved), 0)
    )::INTEGER as total_pending,
    CASE 
      WHEN oi.quantity = 0 THEN 0
      ELSE ROUND(
        (COALESCE(SUM(di.quantity_approved), 0)::NUMERIC / oi.quantity::NUMERIC) * 100, 
        2
      )
    END as completion_percentage
  FROM public.order_items oi
  INNER JOIN public.product_variants pv ON oi.product_variant_id = pv.id
  INNER JOIN public.products p ON pv.product_id = p.id
  LEFT JOIN public.delivery_items di ON oi.id = di.order_item_id
  LEFT JOIN public.deliveries d ON di.delivery_id = d.id AND d.order_id = order_id_param
  WHERE oi.order_id = order_id_param
  GROUP BY p.name, pv.size, pv.color, pv.sku_variant, oi.quantity
  ORDER BY p.name, pv.size, pv.color;
$$;

CREATE OR REPLACE FUNCTION public.has_recent_successful_sync(delivery_id_param uuid, minutes_threshold integer DEFAULT 30)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_sync_logs 
    WHERE delivery_id = delivery_id_param 
    AND success_count > 0 
    AND error_count = 0
    AND verification_status = 'verified'
    AND synced_at > now() - (minutes_threshold || ' minutes')::interval
  );
$$;

CREATE OR REPLACE FUNCTION public.recalculate_material_deliveries_remaining()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  delivery_record RECORD;
  total_consumed_after numeric;
BEGIN
  FOR delivery_record IN 
    SELECT id, material_id, workshop_id, quantity_delivered, delivery_date, created_at
    FROM public.material_deliveries 
    WHERE quantity_delivered > 0
    ORDER BY material_id, workshop_id, delivery_date ASC, created_at ASC
  LOOP
    SELECT COALESCE(SUM(md.quantity_consumed), 0) INTO total_consumed_after
    FROM public.material_deliveries md
    WHERE md.material_id = delivery_record.material_id 
      AND md.workshop_id = delivery_record.workshop_id
      AND md.quantity_consumed > 0
      AND (md.delivery_date > delivery_record.delivery_date 
           OR (md.delivery_date = delivery_record.delivery_date AND md.created_at > delivery_record.created_at));
    
    UPDATE public.material_deliveries 
    SET quantity_remaining = GREATEST(0, delivery_record.quantity_delivered - total_consumed_after),
        updated_at = now()
    WHERE id = delivery_record.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_order_materials(order_id_param uuid, consumption_data jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  consumption_item jsonb;
  material_uuid uuid;
  quantity_to_consume numeric;
  delivery_record RECORD;
  remaining_to_consume numeric;
  consume_from_delivery numeric;
  workshop_id_record uuid;
  current_stock_info RECORD;
  material_info RECORD;
BEGIN
  SELECT workshop_id INTO workshop_id_record
  FROM public.workshop_assignments 
  WHERE order_id = order_id_param 
  AND status IN ('assigned', 'in_progress', 'completed')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF workshop_id_record IS NULL THEN
    RAISE EXCEPTION 'La orden % no está asignada a ningún taller o no tiene asignación activa.', order_id_param;
  END IF;
  
  FOR consumption_item IN SELECT * FROM jsonb_array_elements(consumption_data) LOOP
    material_uuid := (consumption_item->>'material_id')::uuid;
    quantity_to_consume := (consumption_item->>'quantity')::numeric;
    remaining_to_consume := quantity_to_consume;
    
    SELECT name, sku INTO material_info
    FROM public.materials 
    WHERE id = material_uuid;
    
    SELECT * INTO current_stock_info
    FROM public.get_workshop_material_stock(material_uuid, workshop_id_record);
    
    IF current_stock_info.available_stock < quantity_to_consume THEN
      RAISE EXCEPTION 'Stock insuficiente para material % (%)', material_info.name, material_info.sku;
    END IF;
    
    FOR delivery_record IN 
      SELECT id, quantity_remaining, workshop_id, delivery_date, created_at
      FROM public.material_deliveries 
      WHERE material_id = material_uuid 
        AND quantity_remaining > 0
        AND workshop_id = workshop_id_record
      ORDER BY delivery_date ASC, created_at ASC
    LOOP
      IF remaining_to_consume <= 0 THEN
        EXIT;
      END IF;
      
      consume_from_delivery := LEAST(delivery_record.quantity_remaining, remaining_to_consume);
      
      INSERT INTO public.material_deliveries (
        material_id,
        workshop_id,
        order_id,
        quantity_delivered,
        quantity_consumed,
        quantity_remaining,
        delivery_date,
        delivered_by,
        notes,
        created_at,
        updated_at
      )
      SELECT 
        material_id,
        workshop_id_record,
        order_id_param,
        0,
        consume_from_delivery,
        0,
        CURRENT_DATE,
        delivered_by,
        format('Consumo para orden %s', 
          (SELECT order_number FROM public.orders WHERE id = order_id_param)
        ),
        now(),
        now()
      FROM public.material_deliveries 
      WHERE id = delivery_record.id;
      
      UPDATE public.material_deliveries 
      SET quantity_remaining = quantity_remaining - consume_from_delivery,
          updated_at = now()
      WHERE id = delivery_record.id;
      
      remaining_to_consume := remaining_to_consume - consume_from_delivery;
    END LOOP;
    
    IF remaining_to_consume > 0 THEN
      RAISE EXCEPTION 'Error inesperado: No se pudo consumir toda la cantidad para material % (%)', material_info.name, material_info.sku;
    END IF;
  END LOOP;
END;
$$;