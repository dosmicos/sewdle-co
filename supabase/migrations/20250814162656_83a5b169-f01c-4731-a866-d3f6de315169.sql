-- CRITICAL SECURITY FIX: Phase 2E - Fix final remaining Function Security Issues
-- Complete fixing all remaining database functions with missing search_path

CREATE OR REPLACE FUNCTION public.get_delivery_stats_admin()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint, organization_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    COUNT(d.*) as total_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE d.status = 'rejected') as rejected_deliveries,
    o.name as organization_name
  FROM public.deliveries d
  JOIN public.organizations o ON d.organization_id = o.id
  WHERE d.organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL
  AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
  GROUP BY o.name;
$$;

CREATE OR REPLACE FUNCTION public.log_stats_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.sync_control_logs (
    sync_type,
    sync_mode, 
    status,
    error_message,
    execution_details
  ) VALUES (
    'security_audit',
    'stats_access',
    'completed',
    format('User %s accessed delivery stats', auth.uid()::text),
    jsonb_build_object(
      'user_id', auth.uid(),
      'organization_id', get_current_organization_safe(),
      'access_type', 'delivery_stats',
      'timestamp', now()
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role_info(user_uuid uuid)
RETURNS TABLE(role_name text, permissions jsonb, workshop_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    r.name as role_name,
    r.permissions,
    ur.workshop_id
  FROM public.user_roles ur
  JOIN public.roles r ON ur.role_id = r.id
  WHERE ur.user_id = user_uuid 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_workshop_permissions()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    CASE 
      WHEN auth.uid() IS NULL THEN false
      ELSE true
    END;
$$;

CREATE OR REPLACE FUNCTION public.clear_delivery_sync_lock(delivery_id_param uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.clear_stale_sync_locks()
RETURNS jsonb[]
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.calculate_delivery_payment(delivery_id_param uuid)
RETURNS TABLE(total_units integer, billable_units integer, gross_amount numeric, advance_deduction numeric, net_amount numeric, workshop_payment_method text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workshop_method TEXT;
  workshop_id_param UUID;
  total_delivered INTEGER := 0;
  total_billable INTEGER := 0;
  gross_total NUMERIC := 0;
  advance_total NUMERIC := 0;
  net_total NUMERIC := 0;
BEGIN
  SELECT w.payment_method, d.workshop_id INTO workshop_method, workshop_id_param
  FROM public.deliveries d
  JOIN public.workshops w ON d.workshop_id = w.id
  WHERE d.id = delivery_id_param;
  
  IF workshop_method IS NULL THEN
    workshop_method := 'approved';
  END IF;
  
  SELECT 
    COALESCE(SUM(di.quantity_delivered), 0),
    CASE 
      WHEN workshop_method = 'approved' THEN COALESCE(SUM(di.quantity_approved), 0)
      ELSE COALESCE(SUM(di.quantity_delivered), 0)
    END
  INTO total_delivered, total_billable
  FROM public.delivery_items di
  WHERE di.delivery_id = delivery_id_param;
  
  SELECT COALESCE(SUM(
    CASE 
      WHEN workshop_method = 'approved' THEN 
        di.quantity_approved * COALESCE(wp.unit_price, oi.unit_price)
      ELSE 
        di.quantity_delivered * COALESCE(wp.unit_price, oi.unit_price)
    END
  ), 0)
  INTO gross_total
  FROM public.delivery_items di
  JOIN public.order_items oi ON di.order_item_id = oi.id
  JOIN public.product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN public.workshop_pricing wp ON workshop_id_param = wp.workshop_id 
    AND pv.product_id = wp.product_id
    AND wp.effective_from <= CURRENT_DATE
    AND (wp.effective_until IS NULL OR wp.effective_until > CURRENT_DATE)
  WHERE di.delivery_id = delivery_id_param;
  
  SELECT COALESCE(SUM(oa.amount), 0) INTO advance_total
  FROM public.deliveries d
  JOIN public.order_advances oa ON d.order_id = oa.order_id AND d.workshop_id = oa.workshop_id
  WHERE d.id = delivery_id_param;
  
  net_total := gross_total - advance_total;
  
  RETURN QUERY SELECT 
    total_delivered,
    total_billable,
    gross_total,
    advance_total,
    net_total,
    workshop_method;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_variant_update_safety(variant_id_param uuid, new_sku_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_sku text;
  references_info jsonb := '{}';
  pending_deliveries integer := 0;
  warnings text[] := ARRAY[]::text[];
BEGIN
  SELECT sku_variant INTO current_sku
  FROM public.product_variants
  WHERE id = variant_id_param;
  
  IF current_sku IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
    );
  END IF;
  
  IF new_sku_param != current_sku AND EXISTS (
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
  
  references_info := jsonb_build_object(
    'order_items', (
      SELECT COUNT(*) FROM public.order_items
      WHERE product_variant_id = variant_id_param
    ),
    'replenishment_suggestions', (
      SELECT COUNT(*) FROM public.replenishment_suggestions
      WHERE product_variant_id = variant_id_param
    ),
    'replenishment_config', (
      SELECT COUNT(*) FROM public.replenishment_config
      WHERE product_variant_id = variant_id_param
    ),
    'sales_metrics', (
      SELECT COUNT(*) FROM public.sales_metrics
      WHERE product_variant_id = variant_id_param
    )
  );
  
  SELECT COUNT(*) INTO pending_deliveries
  FROM public.delivery_items di
  JOIN public.deliveries d ON di.delivery_id = d.id
  JOIN public.order_items oi ON di.order_item_id = oi.id
  WHERE oi.product_variant_id = variant_id_param
  AND d.synced_to_shopify = false;
  
  IF pending_deliveries > 0 THEN
    warnings := array_append(warnings, 
      format('Hay %s entregas pendientes de sincronizar con Shopify que usan esta variante', pending_deliveries)
    );
  END IF;
  
  IF (references_info->>'order_items')::integer > 0 THEN
    warnings := array_append(warnings,
      format('Esta variante está referenciada en %s órdenes', references_info->>'order_items')
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'current_sku', current_sku,
    'new_sku', new_sku_param,
    'references', references_info,
    'warnings', warnings,
    'pending_deliveries', pending_deliveries
  );
END;
$$;