-- CRITICAL SECURITY FIX: Phase 2B - Fix remaining Function Security Issues
-- Continue fixing all remaining database functions with missing search_path

CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries
  WHERE organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
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
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_workshop_material_stock(material_id_param uuid, workshop_id_param uuid)
RETURNS TABLE(available_stock numeric, total_delivered numeric, total_consumed numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT 
    GREATEST(0, COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0)) as available_stock,
    COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered,
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed
  FROM public.material_deliveries md
  WHERE md.material_id = material_id_param 
    AND md.workshop_id = workshop_id_param;
$$;

CREATE OR REPLACE FUNCTION public.update_order_status_from_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_ordered INTEGER;
  total_approved INTEGER;
  order_uuid UUID;
  has_deliveries BOOLEAN;
BEGIN
  order_uuid := COALESCE(NEW.order_id, OLD.order_id);
  
  IF order_uuid IS NULL THEN
    SELECT d.order_id INTO order_uuid
    FROM public.deliveries d
    WHERE d.id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  END IF;
  
  IF order_uuid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  SELECT COALESCE(SUM(quantity), 0) INTO total_ordered
  FROM public.order_items 
  WHERE order_id = order_uuid;
  
  SELECT COALESCE(SUM(di.quantity_approved), 0) INTO total_approved
  FROM public.delivery_items di
  JOIN public.deliveries d ON di.delivery_id = d.id
  WHERE d.order_id = order_uuid;
  
  SELECT EXISTS(SELECT 1 FROM public.deliveries WHERE order_id = order_uuid) INTO has_deliveries;
  
  IF total_approved >= total_ordered AND total_ordered > 0 THEN
    UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = order_uuid;
  ELSIF has_deliveries THEN
    UPDATE public.orders SET status = 'in_progress', updated_at = now() WHERE id = order_uuid;
  ELSIF EXISTS (SELECT 1 FROM public.workshop_assignments WHERE order_id = order_uuid AND status IN ('assigned', 'in_progress')) THEN
    UPDATE public.orders SET status = 'assigned', updated_at = now() WHERE id = order_uuid;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_delivery_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.update_variant_sku_cascade(variant_id_param uuid, new_sku_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_sku text;
  affected_tables jsonb := '{}';
  result_summary jsonb;
BEGIN
  SELECT sku_variant INTO old_sku
  FROM public.product_variants
  WHERE id = variant_id_param;
  
  IF old_sku IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
    );
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.product_variants 
    WHERE sku_variant = new_sku_param 
    AND id != variant_id_param
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SKU already exists',
      'conflicting_sku', new_sku_param
    );
  END IF;
  
  UPDATE public.product_variants
  SET sku_variant = new_sku_param,
      updated_at = now()
  WHERE id = variant_id_param;
  
  affected_tables := jsonb_set(
    affected_tables,
    '{delivery_items}',
    (SELECT COUNT(*)::text::jsonb FROM public.delivery_items di 
     JOIN public.order_items oi ON di.order_item_id = oi.id
     WHERE oi.product_variant_id = variant_id_param)
  );
  
  affected_tables := jsonb_set(
    affected_tables,
    '{order_items}',
    (SELECT COUNT(*)::text::jsonb FROM public.order_items
     WHERE product_variant_id = variant_id_param)
  );
  
  result_summary := jsonb_build_object(
    'success', true,
    'old_sku', old_sku,
    'new_sku', new_sku_param,
    'variant_id', variant_id_param,
    'affected_tables', affected_tables
  );
  
  RETURN result_summary;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;