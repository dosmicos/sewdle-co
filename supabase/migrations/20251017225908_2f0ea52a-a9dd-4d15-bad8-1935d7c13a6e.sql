-- Crear tabla de historial de stock
CREATE TABLE IF NOT EXISTS public.product_stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'shopify_webhook',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas
CREATE INDEX idx_stock_history_variant_date 
ON public.product_stock_history(product_variant_id, recorded_at DESC);

CREATE INDEX idx_stock_history_org_date 
ON public.product_stock_history(organization_id, recorded_at DESC);

-- RLS policies
ALTER TABLE public.product_stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock history in their organization"
ON public.product_stock_history FOR SELECT
USING (organization_id = get_current_organization_safe());

CREATE POLICY "System can insert stock history"
ON public.product_stock_history FOR INSERT
WITH CHECK (true);

-- Función mejorada de cálculo de reposición con días reales de stock
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions(org_id UUID DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  result_summary jsonb;
  suggestions_created INTEGER := 0;
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

    -- Calcular días con stock disponible (stock > 0) en los últimos 30 días
    SELECT COUNT(DISTINCT DATE(recorded_at))::INTEGER INTO days_with_stock
    FROM public.product_stock_history
    WHERE product_variant_id = rec.variant_id
      AND organization_id = current_org_id
      AND recorded_at >= CURRENT_DATE - INTERVAL '30 days'
      AND stock_quantity > 0;

    -- Fallback: si no hay historial pero hay stock actual, asumir disponibilidad
    IF days_with_stock = 0 AND rec.current_stock > 0 THEN
      days_with_stock := 30;
    ELSIF days_with_stock = 0 AND sales_30_days > 0 THEN
      -- Si hubo ventas pero no hay historial, inferir días mínimos
      days_with_stock := LEAST(30, sales_30_days);
    ELSIF days_with_stock = 0 THEN
      days_with_stock := 1; -- Evitar división por cero
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
        days_with_stock_data
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
        days_with_stock
      )
      ON CONFLICT (product_variant_id, calculation_date) 
      DO UPDATE SET
        current_stock = EXCLUDED.current_stock,
        suggested_quantity = EXCLUDED.suggested_quantity,
        sales_velocity = EXCLUDED.sales_velocity,
        days_of_stock = EXCLUDED.days_of_stock,
        open_orders_quantity = EXCLUDED.open_orders_quantity,
        urgency_level = EXCLUDED.urgency_level,
        reason = EXCLUDED.reason,
        days_with_stock_data = EXCLUDED.days_with_stock_data,
        updated_at = now();
      
      suggestions_created := suggestions_created + 1;
    END IF;
  END LOOP;

  result_summary := jsonb_build_object(
    'organization_id', current_org_id,
    'calculation_date', CURRENT_DATE,
    'suggestions_created', suggestions_created,
    'status', 'completed'
  );

  RETURN result_summary;
END;
$$;

-- Agregar columna para almacenar días con stock en sugerencias
ALTER TABLE public.replenishment_suggestions 
ADD COLUMN IF NOT EXISTS days_with_stock_data INTEGER DEFAULT 30;