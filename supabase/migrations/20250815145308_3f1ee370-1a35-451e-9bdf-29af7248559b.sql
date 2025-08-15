-- Update calculate_replenishment_suggestions to avoid unsupported %.1f in format() and control precision
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Limpiar sugerencias previas del día actual para la organización
  DELETE FROM public.replenishment_suggestions 
  WHERE calculation_date = CURRENT_DATE
    AND organization_id = current_org_id;

  -- Iterar sobre variantes con métricas de ventas recientes
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
        FROM public.sales_metrics sm 
        WHERE sm.product_variant_id = pv.id 
          AND sm.organization_id = current_org_id
          AND sm.metric_date >= CURRENT_DATE - INTERVAL '60 days'
      )
    ORDER BY p.name, pv.size, pv.color
  LOOP
    -- Ventas últimos 30 días
    SELECT COALESCE(SUM(sales_quantity), 0) INTO sales_30_days
    FROM public.sales_metrics
    WHERE product_variant_id = rec.variant_id
      AND organization_id = current_org_id
      AND metric_date >= CURRENT_DATE - INTERVAL '30 days';

    -- Velocidad de ventas (promedio diario) con precisión controlada
    sales_velocity := CASE 
      WHEN sales_30_days > 0 THEN ROUND(sales_30_days::NUMERIC / 30.0, 4)
      ELSE 0
    END;

    -- Días de stock restantes con precisión controlada
    days_remaining := CASE 
      WHEN sales_velocity > 0 THEN ROUND(rec.current_stock / sales_velocity, 2)
      ELSE 9999
    END;

    -- Órdenes abiertas (pendientes de producir)
    SELECT COALESCE(SUM(
      oi.quantity - COALESCE(approved_deliveries.total_approved, 0)
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
      AND o.status IN ('pending', 'assigned', 'in_progress')
      AND (oi.quantity - COALESCE(approved_deliveries.total_approved, 0)) > 0;

    -- Demanda proyectada (lead time + safety)
    projected_demand := CEIL(sales_velocity * target_stock_days);

    -- Cantidad sugerida
    suggested_qty := GREATEST(0, projected_demand + open_orders_qty - rec.current_stock);

    -- Formato seguro para mensajes (usar %s en lugar de %.1f)
    days_remaining_fmt := ROUND(days_remaining, 1)::text;

    -- Nivel de urgencia y motivo
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

    -- Insertar sugerencia si aplica
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
$function$;