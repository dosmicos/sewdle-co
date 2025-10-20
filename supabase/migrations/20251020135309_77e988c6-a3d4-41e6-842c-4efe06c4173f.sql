-- Enable required extensions for cron job
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job for daily inventory snapshot
-- Runs every day at 00:00 UTC (7:00 PM Colombia time)
SELECT cron.schedule(
  'snapshot-daily-inventory',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/snapshot-daily-inventory',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI"}'::jsonb,
      body:=concat('{"timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Update calculate_replenishment_suggestions to use improved days_with_stock calculation
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions(org_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_org_id UUID;
  rec RECORD;
  sales_30_days INTEGER;
  sales_velocity NUMERIC;
  days_of_stock NUMERIC;
  suggested_quantity INTEGER;
  urgency_level TEXT;
  reason_text TEXT;
  open_orders_qty INTEGER;
  days_with_stock INTEGER;
  suggestions_created INTEGER := 0;
  data_quality_level TEXT;
  snapshot_days INTEGER;
  variant_age_days INTEGER;
BEGIN
  current_org_id := COALESCE(org_id, public.get_current_organization_safe());
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  -- Limpiar sugerencias antiguas
  DELETE FROM public.replenishment_suggestions 
  WHERE organization_id = current_org_id 
  AND calculation_date < CURRENT_DATE;

  -- Iterar sobre variantes de productos activos
  FOR rec IN 
    SELECT 
      pv.id as variant_id,
      pv.sku_variant,
      pv.stock_quantity as current_stock,
      pv.created_at as variant_created_at,
      p.name as product_name
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE p.organization_id = current_org_id
      AND p.status = 'active'
      AND pv.stock_quantity IS NOT NULL
  LOOP
    -- Calcular ventas últimos 30 días
    SELECT COALESCE(SUM(soli.quantity), 0)::INTEGER INTO sales_30_days
    FROM public.shopify_order_line_items soli
    JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    WHERE soli.sku = rec.sku_variant
      AND so.organization_id = current_org_id
      AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'pending');

    -- Contar días ÚNICOS con snapshots diarios en los últimos 30 días
    SELECT COUNT(DISTINCT DATE(recorded_at))::INTEGER INTO snapshot_days
    FROM public.product_stock_history
    WHERE product_variant_id = rec.variant_id
      AND organization_id = current_org_id
      AND recorded_at >= CURRENT_DATE - INTERVAL '30 days'
      AND source = 'daily_snapshot';

    -- Contar días con stock > 0 en los últimos 30 días (cualquier fuente)
    SELECT COUNT(DISTINCT DATE(recorded_at))::INTEGER INTO days_with_stock
    FROM public.product_stock_history
    WHERE product_variant_id = rec.variant_id
      AND organization_id = current_org_id
      AND recorded_at >= CURRENT_DATE - INTERVAL '30 days'
      AND stock_quantity > 0;

    -- Calcular edad de la variante en días
    variant_age_days := DATE_PART('day', CURRENT_DATE - DATE(rec.variant_created_at))::INTEGER;

    -- Determinar calidad de datos y days_with_stock
    IF snapshot_days >= 25 THEN
      -- Alta calidad: tenemos snapshots diarios completos
      data_quality_level := 'high';
      -- days_with_stock ya está calculado correctamente
    ELSIF days_with_stock > 0 THEN
      -- Calidad media: datos inferidos de webhooks
      data_quality_level := 'medium';
      -- Usar días con stock de cualquier fuente
    ELSIF rec.current_stock > 0 AND variant_age_days > 0 THEN
      -- Calidad baja: estimación basada en edad de variante
      data_quality_level := 'low';
      days_with_stock := LEAST(30, variant_age_days);
    ELSIF sales_30_days > 0 THEN
      -- Calidad baja: inferir de ventas
      data_quality_level := 'low';
      days_with_stock := LEAST(30, sales_30_days);
    ELSE
      -- Datos insuficientes
      data_quality_level := 'insufficient';
      days_with_stock := NULL;
    END IF;

    -- Si no hay días con stock o datos insuficientes, saltar
    IF days_with_stock IS NULL OR days_with_stock = 0 THEN
      CONTINUE;
    END IF;

    -- Calcular velocidad de ventas con días reales de stock
    sales_velocity := CASE 
      WHEN sales_30_days > 0 AND days_with_stock > 0 
        THEN sales_30_days::NUMERIC / days_with_stock::NUMERIC
      ELSE 0
    END;

    -- Calcular días de stock restante
    IF sales_velocity > 0 THEN
      days_of_stock := rec.current_stock::NUMERIC / sales_velocity;
    ELSE
      days_of_stock := 999;
    END IF;

    -- Calcular órdenes abiertas
    SELECT COALESCE(SUM(oi.quantity), 0)::INTEGER INTO open_orders_qty
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = rec.variant_id
      AND o.organization_id = current_org_id
      AND o.status IN ('pending', 'assigned', 'in_production');

    -- Determinar urgencia y cantidad sugerida
    IF days_of_stock <= 7 OR rec.current_stock = 0 THEN
      urgency_level := 'critical';
      suggested_quantity := GREATEST(30, CEIL(sales_velocity * 30)::INTEGER);
      reason_text := format('Stock crítico: solo %s días de inventario disponible', ROUND(days_of_stock, 1));
    ELSIF days_of_stock <= 14 THEN
      urgency_level := 'high';
      suggested_quantity := CEIL(sales_velocity * 21)::INTEGER;
      reason_text := format('Stock bajo: %s días de inventario', ROUND(days_of_stock, 1));
    ELSIF days_of_stock <= 21 THEN
      urgency_level := 'normal';
      suggested_quantity := CEIL(sales_velocity * 14)::INTEGER;
      reason_text := format('Reposición normal: %s días de stock', ROUND(days_of_stock, 1));
    ELSE
      urgency_level := 'low';
      suggested_quantity := 0;
      reason_text := format('Stock suficiente: %s días', ROUND(days_of_stock, 1));
    END IF;

    -- Insertar/actualizar sugerencia solo si es necesaria
    IF urgency_level IN ('critical', 'high', 'normal') THEN
      INSERT INTO public.replenishment_suggestions (
        product_variant_id,
        organization_id,
        current_stock,
        suggested_quantity,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        urgency_level,
        reason,
        calculation_date,
        status,
        days_with_stock_data,
        data_quality
      ) VALUES (
        rec.variant_id,
        current_org_id,
        rec.current_stock,
        suggested_quantity,
        ROUND(sales_velocity, 2),
        ROUND(days_of_stock, 1),
        open_orders_qty,
        urgency_level,
        reason_text,
        CURRENT_DATE,
        'pending',
        days_with_stock,
        data_quality_level
      )
      ON CONFLICT (product_variant_id, calculation_date, organization_id) 
      DO UPDATE SET
        current_stock = EXCLUDED.current_stock,
        suggested_quantity = EXCLUDED.suggested_quantity,
        sales_velocity = EXCLUDED.sales_velocity,
        days_of_stock = EXCLUDED.days_of_stock,
        open_orders_quantity = EXCLUDED.open_orders_quantity,
        urgency_level = EXCLUDED.urgency_level,
        reason = EXCLUDED.reason,
        days_with_stock_data = EXCLUDED.days_with_stock_data,
        data_quality = EXCLUDED.data_quality,
        updated_at = now();
      
      suggestions_created := suggestions_created + 1;
    END IF;
  END LOOP;
END;
$function$;