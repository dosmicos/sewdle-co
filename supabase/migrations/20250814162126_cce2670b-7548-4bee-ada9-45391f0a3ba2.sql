-- CRITICAL SECURITY FIX: Phase 2 - Fix Function Security Issues
-- Fix all remaining database functions with missing search_path

-- Update all existing functions to include SET search_path = ''
CREATE OR REPLACE FUNCTION public.cleanup_old_sku_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Eliminar logs completados más antiguos de 30 días
  DELETE FROM public.sku_assignment_logs 
  WHERE status IN ('completed', 'failed') 
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
BEGIN
  current_org_id := get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;
  
  target_stock_days := lead_time_days + safety_days;

  -- Limpiar sugerencias previas del día actual para la organización
  DELETE FROM public.replenishment_suggestions 
  WHERE calculation_date = CURRENT_DATE
  AND organization_id = current_org_id;

  -- Iterar sobre todas las variantes activas con ventas de la organización
  FOR rec IN 
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size,
      pv.color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE pv.is_active = true
    AND p.organization_id = current_org_id
    AND EXISTS (
      SELECT 1 FROM public.sales_metrics sm 
      WHERE sm.product_variant_id = pv.id 
      AND sm.organization_id = current_org_id
      AND sm.metric_date >= CURRENT_DATE - INTERVAL '60 days'
    )
    ORDER BY p.name, pv.size, pv.color
  LOOP
    -- Calcular ventas de los últimos 30 días
    SELECT COALESCE(SUM(sales_quantity), 0) INTO sales_30_days
    FROM public.sales_metrics
    WHERE product_variant_id = rec.variant_id
    AND organization_id = current_org_id
    AND metric_date >= CURRENT_DATE - INTERVAL '30 days';

    -- Calcular velocidad de ventas (promedio diario)
    sales_velocity := CASE 
      WHEN sales_30_days > 0 THEN sales_30_days::NUMERIC / 30.0
      ELSE 0
    END;

    -- Calcular días de stock restantes
    days_remaining := CASE 
      WHEN sales_velocity > 0 THEN rec.current_stock / sales_velocity
      ELSE 9999
    END;

    -- Calcular órdenes abiertas (pendientes de producir)
    SELECT COALESCE(SUM(
      oi.quantity - COALESCE(approved_deliveries.total_approved, 0)
    ), 0) INTO open_orders_qty
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
    WHERE oi.product_variant_id = rec.variant_id
    AND o.organization_id = current_org_id
    AND o.status IN ('pending', 'assigned', 'in_progress')
    AND (oi.quantity - COALESCE(approved_deliveries.total_approved, 0)) > 0;

    -- Calcular demanda proyectada para el período de lead time + safety
    projected_demand := CEIL(sales_velocity * target_stock_days);

    -- Calcular cantidad sugerida
    suggested_qty := GREATEST(0, projected_demand + open_orders_qty - rec.current_stock);

    -- Determinar nivel de urgencia
    IF days_remaining <= (lead_time_days * 0.5) THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= 20 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= target_stock_days THEN
      urgency := 'normal';
      reason_text := format('Reposición preventiva: %.1f días restantes (objetivo %s días)', days_remaining, target_stock_days);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %.1f días restantes', days_remaining);
    END IF;

    -- Solo insertar si hay sugerencia significativa o urgencia
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
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organizations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_organization_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_available_orders()
RETURNS TABLE(id uuid, order_number text, due_date date, total_amount numeric, status text, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_current_organization_for_views()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT organization_id 
  FROM public.organization_users 
  WHERE user_id = auth.uid() 
  AND status = 'active' 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_workshop_capacity_stats()
RETURNS TABLE(workshop_id uuid, workshop_name text, total_capacity integer, current_assignments bigint, available_capacity integer, completion_rate numeric)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
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
  FROM public.workshops w
  LEFT JOIN public.workshop_assignments wa ON w.id = wa.workshop_id
  WHERE w.status = 'active'
  GROUP BY w.id, w.name, w.capacity
  ORDER BY w.name;
$$;