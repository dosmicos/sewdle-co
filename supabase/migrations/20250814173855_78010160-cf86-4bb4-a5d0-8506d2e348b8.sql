-- Security Fix: Set search_path for all database functions to prevent SQL injection
-- This fixes the mutable search_path security warnings

-- Fix auto_assign_organization function
CREATE OR REPLACE FUNCTION public.auto_assign_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix get_available_orders function
CREATE OR REPLACE FUNCTION public.get_available_orders()
 RETURNS TABLE(id uuid, order_number text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 
    o.id,
    o.order_number,
    o.due_date,
    o.total_amount,
    o.status,
    o.created_at
  FROM public.orders o
  WHERE o.status IN ('pending', 'assigned')
  ORDER BY o.due_date ASC NULLS LAST, o.created_at ASC;
$function$;

-- Fix get_deliveries_with_details function
CREATE OR REPLACE FUNCTION public.get_deliveries_with_details()
 RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
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
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

-- Fix get_workshop_material_stock function
CREATE OR REPLACE FUNCTION public.get_workshop_material_stock(material_id_param uuid, workshop_id_param uuid)
 RETURNS TABLE(available_stock numeric, total_delivered numeric, total_consumed numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 
    GREATEST(0, COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0)) as available_stock,
    COALESCE(SUM(CASE WHEN md.quantity_delivered > 0 THEN md.quantity_delivered ELSE 0 END), 0) as total_delivered,
    COALESCE(SUM(CASE WHEN md.quantity_consumed > 0 THEN md.quantity_consumed ELSE 0 END), 0) as total_consumed
  FROM public.material_deliveries md
  WHERE md.material_id = material_id_param 
    AND md.workshop_id = workshop_id_param;
$function$;

-- Fix get_current_organization_for_views function
CREATE OR REPLACE FUNCTION public.get_current_organization_for_views()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$function$;

-- Fix get_material_consumptions_by_order function
CREATE OR REPLACE FUNCTION public.get_material_consumptions_by_order()
 RETURNS TABLE(id uuid, material_id uuid, workshop_id uuid, order_id uuid, quantity_consumed numeric, delivery_date date, created_at timestamp with time zone, updated_at timestamp with time zone, material_name text, material_unit text, material_category text, material_color text, workshop_name text, order_number text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$;

-- Fix user_has_workshop_permissions function
CREATE OR REPLACE FUNCTION public.user_has_workshop_permissions()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT 
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE true
    END;
$function$;

-- Fix clear_delivery_sync_lock function
CREATE OR REPLACE FUNCTION public.clear_delivery_sync_lock(delivery_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  delivery_record RECORD;
BEGIN
  SELECT d.tracking_number, d.synced_to_shopify, d.last_sync_attempt
  INTO delivery_record
  FROM public.deliveries d
  WHERE d.id = delivery_id_param;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found'
    );
  END IF;
  
  UPDATE public.deliveries
  SET 
    sync_attempts = 0,
    sync_error_message = NULL,
    last_sync_attempt = NULL,
    updated_at = now()
  WHERE id = delivery_id_param;
  
  RETURN jsonb_build_object(
    'success', true,
    'tracking_number', delivery_record.tracking_number,
    'message', 'Sync lock cleared successfully'
  );
END;
$function$;

-- Fix clear_stale_sync_locks function
CREATE OR REPLACE FUNCTION public.clear_stale_sync_locks()
 RETURNS jsonb[]
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  cleared_count INTEGER;
BEGIN
  UPDATE public.deliveries
  SET 
    sync_attempts = 0,
    sync_error_message = NULL,
    last_sync_attempt = NULL,
    updated_at = now()
  WHERE 
    last_sync_attempt < now() - INTERVAL '2 hours'
    AND synced_to_shopify = false
    AND sync_attempts > 0;
  
  GET DIAGNOSTICS cleared_count = ROW_COUNT;
  
  RETURN ARRAY[jsonb_build_object(
    'success', true,
    'cleared_deliveries_count', cleared_count,
    'message', format('Cleared %s stale sync locks', cleared_count)
  )];
END;
$function$;

-- Fix get_workshop_financial_summary function
CREATE OR REPLACE FUNCTION public.get_workshop_financial_summary(workshop_id_param uuid, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(total_deliveries integer, pending_payments integer, paid_deliveries integer, total_gross_amount numeric, total_advances numeric, total_net_amount numeric, total_paid_amount numeric, pending_amount numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  WITH delivery_stats AS (
    SELECT 
      COUNT(*) as delivery_count,
      COUNT(*) FILTER (WHERE dp.payment_status = 'pending') as pending_count,
      COUNT(*) FILTER (WHERE dp.payment_status = 'paid') as paid_count,
      COALESCE(SUM(dp.gross_amount), 0) as gross_total,
      COALESCE(SUM(dp.advance_deduction), 0) as advance_total,
      COALESCE(SUM(dp.net_amount), 0) as net_total,
      COALESCE(SUM(CASE WHEN dp.payment_status = 'paid' THEN dp.net_amount ELSE 0 END), 0) as paid_total,
      COALESCE(SUM(CASE WHEN dp.payment_status = 'pending' THEN dp.net_amount ELSE 0 END), 0) as pending_total
    FROM public.deliveries d
    LEFT JOIN public.delivery_payments dp ON d.id = dp.delivery_id
    WHERE d.workshop_id = workshop_id_param
      AND (start_date IS NULL OR d.delivery_date >= start_date)
      AND (end_date IS NULL OR d.delivery_date <= end_date)
  )
  SELECT 
    delivery_count::INTEGER,
    pending_count::INTEGER,
    paid_count::INTEGER,
    gross_total,
    advance_total,
    net_total,
    paid_total,
    pending_total
  FROM delivery_stats;
$function$;

-- Fix get_deliveries_with_sync_status function
CREATE OR REPLACE FUNCTION public.get_deliveries_with_sync_status()
 RETURNS TABLE(id uuid, tracking_number text, order_id uuid, order_number text, workshop_id uuid, workshop_name text, delivery_date date, status text, delivered_by uuid, delivered_by_name text, recipient_name text, recipient_phone text, recipient_address text, notes text, created_at timestamp with time zone, items_count bigint, total_quantity bigint, total_approved bigint, total_defective bigint, synced_to_shopify boolean, sync_attempts integer, last_sync_attempt timestamp with time zone, sync_error_message text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
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
    COALESCE(SUM(di.quantity_delivered), 0) as total_quantity,
    COALESCE(SUM(di.quantity_approved), 0) as total_approved,
    COALESCE(SUM(di.quantity_defective), 0) as total_defective,
    d.synced_to_shopify,
    d.sync_attempts,
    d.last_sync_attempt,
    d.sync_error_message
  FROM public.deliveries d
  LEFT JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.workshops w ON d.workshop_id = w.id
  LEFT JOIN public.profiles p ON d.delivered_by = p.id
  LEFT JOIN public.delivery_items di ON d.id = di.delivery_id
  GROUP BY d.id, o.order_number, w.name, p.name
  ORDER BY d.created_at DESC;
$function$;

-- Fix get_financial_report function
CREATE OR REPLACE FUNCTION public.get_financial_report(workshop_id_param uuid DEFAULT NULL::uuid, start_date date DEFAULT NULL::date, end_date date DEFAULT NULL::date)
 RETURNS TABLE(delivery_id uuid, tracking_number text, workshop_name text, order_number text, delivery_date date, total_units integer, billable_units integer, gross_amount numeric, advance_deduction numeric, net_amount numeric, payment_status text, payment_date date, payment_method text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 
    d.id as delivery_id,
    d.tracking_number,
    w.name as workshop_name,
    o.order_number,
    d.delivery_date,
    dp.total_units,
    dp.billable_units,
    dp.gross_amount,
    dp.advance_deduction,
    dp.net_amount,
    dp.payment_status,
    dp.payment_date,
    dp.payment_method
  FROM public.deliveries d
  JOIN public.workshops w ON d.workshop_id = w.id
  JOIN public.orders o ON d.order_id = o.id
  LEFT JOIN public.delivery_payments dp ON d.id = dp.delivery_id
  WHERE (workshop_id_param IS NULL OR d.workshop_id = workshop_id_param)
    AND (start_date IS NULL OR d.delivery_date >= start_date)
    AND (end_date IS NULL OR d.delivery_date <= end_date)
  ORDER BY d.delivery_date DESC, d.created_at DESC;
$function$;

-- Fix get_replenishment_suggestions_with_details function
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
 RETURNS TABLE(id uuid, product_name text, variant_size text, variant_color text, sku_variant text, suggested_quantity integer, current_stock integer, sales_velocity numeric, sales_30_days integer, days_of_stock numeric, open_orders_quantity integer, projected_demand integer, urgency_level text, reason text, status text, calculation_date date, created_at timestamp with time zone, pending_production_quantity integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT 
    rs.id,
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    rs.suggested_quantity,
    rs.current_stock,
    rs.sales_velocity,
    COALESCE((
      SELECT SUM(sm.sales_quantity)::integer
      FROM public.sales_metrics sm
      WHERE sm.product_variant_id = rs.product_variant_id
      AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) as sales_30_days,
    rs.days_of_stock,
    rs.open_orders_quantity,
    rs.projected_demand,
    rs.urgency_level,
    rs.reason,
    rs.status,
    rs.calculation_date,
    rs.created_at,
    COALESCE((
      SELECT SUM(oi.quantity - COALESCE(approved_deliveries.total_approved, 0))
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      LEFT JOIN (
        SELECT 
          di.order_item_id,
          SUM(COALESCE(di.quantity_approved, 0)) as total_approved
        FROM public.delivery_items di
        JOIN public.deliveries d ON di.delivery_id = d.id
        WHERE d.status IN ('approved', 'partial_approved')
        GROUP BY di.order_item_id
      ) approved_deliveries ON oi.id = approved_deliveries.order_item_id
      WHERE oi.product_variant_id = rs.product_variant_id
      AND o.status IN ('pending', 'assigned', 'in_progress')
      AND (oi.quantity - COALESCE(approved_deliveries.total_approved, 0)) > 0
    ), 0) as pending_production_quantity
  FROM public.replenishment_suggestions rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  ORDER BY 
    CASE rs.urgency_level 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
    END,
    rs.suggested_quantity DESC,
    p.name, pv.size, pv.color;
$function$;

-- Fix trigger_replenishment_calculation function
CREATE OR REPLACE FUNCTION public.trigger_replenishment_calculation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT to_jsonb(public.calculate_replenishment_suggestions.*) INTO result
  FROM public.calculate_replenishment_suggestions()
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Cálculo de reposición ejecutado manualmente',
    'timestamp', now(),
    'sample_result', result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$function$;