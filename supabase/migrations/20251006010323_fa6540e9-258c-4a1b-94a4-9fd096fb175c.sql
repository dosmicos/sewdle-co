-- Fix remaining mutable search_path functions for SQL injection protection

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  rec RECORD;
  sales_30_days INTEGER;
  sales_velocity NUMERIC;
  days_remaining NUMERIC;
  open_orders_qty INTEGER;
  projected_demand INTEGER;
  suggested_qty INTEGER;
  urgency TEXT;
  reason_text TEXT;
  lead_time_days INTEGER := 30;
  safety_days INTEGER := 10;
  target_stock_days INTEGER;
  current_org_id UUID;
  days_remaining_fmt TEXT;
BEGIN
  current_org_id := public.get_current_organization_safe();

  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  target_stock_days := lead_time_days + safety_days;

  DELETE FROM public.replenishment_suggestions 
  WHERE calculation_date = CURRENT_DATE
    AND organization_id = current_org_id;

  RAISE NOTICE 'Iniciando cálculo de reposición para organización: %', current_org_id;

  FOR rec IN 
    SELECT 
      pv.id AS variant_id,
      p.name AS product_name,
      pv.size,
      pv.color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) AS current_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE p.organization_id = current_org_id
      AND (p.status IS NULL OR p.status = 'active')
      AND EXISTS (
        SELECT 1
        FROM public.shopify_order_line_items soli
        JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = current_org_id
          AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '60 days'
          AND so.financial_status IN ('paid', 'partially_paid', 'pending')
      )
    ORDER BY p.name, pv.size, pv.color
  LOOP
    SELECT COALESCE(SUM(soli.quantity), 0) INTO sales_30_days
    FROM public.shopify_order_line_items soli
    JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    WHERE soli.sku = rec.sku_variant
      AND so.organization_id = current_org_id
      AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'pending');

    IF sales_30_days > 0 THEN
      sales_velocity := ROUND((sales_30_days::NUMERIC / 30.0), 4);
    ELSE
      sales_velocity := 0;
    END IF;

    IF sales_velocity > 0 THEN
      days_remaining := ROUND(rec.current_stock::NUMERIC / sales_velocity, 2);
    ELSE
      days_remaining := 9999;
    END IF;

    SELECT COALESCE(SUM(
      GREATEST(0, oi.quantity - COALESCE(approved_deliveries.total_approved, 0))
    ), 0) INTO open_orders_qty
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    LEFT JOIN (
      SELECT 
        di.order_item_id,
        SUM(COALESCE(di.quantity_approved, 0)) AS total_approved
      FROM public.delivery_items di
      JOIN public.deliveries d ON di.delivery_id = d.id
      WHERE d.status IN ('approved', 'partial_approved')
      GROUP BY di.order_item_id
    ) approved_deliveries ON oi.id = approved_deliveries.order_item_id
    WHERE oi.product_variant_id = rec.variant_id
      AND o.organization_id = current_org_id
      AND o.status IN ('pending', 'assigned', 'in_progress');

    projected_demand := CEIL(sales_velocity * target_stock_days);
    suggested_qty := GREATEST(0, projected_demand - rec.current_stock - open_orders_qty);
    days_remaining_fmt := ROUND(days_remaining, 1)::text;

    IF days_remaining <= (lead_time_days * 0.5) THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: %s días restantes (lead time %s días)', days_remaining_fmt, lead_time_days::text);
    ELSIF days_remaining <= 20 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %s días restantes (lead time %s días)', days_remaining_fmt, lead_time_days::text);
    ELSIF days_remaining <= target_stock_days THEN
      urgency := 'normal';
      reason_text := format('Reposición preventiva: %s días restantes (objetivo %s días)', days_remaining_fmt, target_stock_days::text);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %s días restantes', days_remaining_fmt);
    END IF;

    IF suggested_qty > 0 OR urgency IN ('critical', 'high') THEN
      INSERT INTO public.replenishment_suggestions (
        product_variant_id,
        organization_id,
        suggested_quantity,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        projected_demand,
        urgency_level,
        reason,
        status,
        calculation_date,
        created_at,
        updated_at
      ) VALUES (
        rec.variant_id,
        current_org_id,
        suggested_qty,
        rec.current_stock,
        sales_velocity,
        ROUND(days_remaining, 1),
        open_orders_qty,
        projected_demand,
        urgency,
        reason_text,
        'pending',
        CURRENT_DATE,
        now(),
        now()
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Cálculo de reposición completado para organización: %', current_org_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_delivery_stats()
RETURNS TABLE(total_deliveries bigint, pending_deliveries bigint, in_quality_deliveries bigint, approved_deliveries bigint, rejected_deliveries bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT 
    COUNT(*) as total_deliveries,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_deliveries,
    COUNT(*) FILTER (WHERE status = 'in_quality') as in_quality_deliveries,
    COUNT(*) FILTER (WHERE status = 'approved') as approved_deliveries,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_deliveries
  FROM public.deliveries
  WHERE organization_id = get_current_organization_safe()
  AND auth.uid() IS NOT NULL;
$function$;

CREATE OR REPLACE FUNCTION public.calculate_okr_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.progress_pct := CASE 
    WHEN NEW.target_value = 0 OR NEW.target_value IS NULL THEN 0
    ELSE GREATEST(0, LEAST(120, (NEW.current_value / NEW.target_value) * 100))
  END;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_workshop_prospects_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;