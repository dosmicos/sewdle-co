-- Add organization_id to replenishment tables and implement RLS policies
-- Step 1: Add organization_id columns
ALTER TABLE public.replenishment_suggestions 
ADD COLUMN organization_id UUID;

ALTER TABLE public.replenishment_config 
ADD COLUMN organization_id UUID;

ALTER TABLE public.sales_metrics 
ADD COLUMN organization_id UUID;

-- Step 2: Populate organization_id for existing records using a default organization
-- This assumes there's at least one organization, we'll use the first one found
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the first organization ID as default
  SELECT id INTO default_org_id FROM public.organizations LIMIT 1;
  
  IF default_org_id IS NOT NULL THEN
    -- Update existing records with the default organization
    UPDATE public.replenishment_suggestions 
    SET organization_id = default_org_id 
    WHERE organization_id IS NULL;
    
    UPDATE public.replenishment_config 
    SET organization_id = default_org_id 
    WHERE organization_id IS NULL;
    
    UPDATE public.sales_metrics 
    SET organization_id = default_org_id 
    WHERE organization_id IS NULL;
  END IF;
END $$;

-- Step 3: Make organization_id NOT NULL and add default
ALTER TABLE public.replenishment_suggestions 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.replenishment_config 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.sales_metrics 
ALTER COLUMN organization_id SET NOT NULL;

-- Step 4: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_org_id 
ON public.replenishment_suggestions(organization_id);

CREATE INDEX IF NOT EXISTS idx_replenishment_config_org_id 
ON public.replenishment_config(organization_id);

CREATE INDEX IF NOT EXISTS idx_sales_metrics_org_id 
ON public.sales_metrics(organization_id);

-- Step 5: Enable RLS on tables that don't have it yet
ALTER TABLE public.replenishment_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replenishment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_metrics ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for replenishment_suggestions (update existing)
DROP POLICY IF EXISTS "Admins and designers can manage replenishment suggestions" ON public.replenishment_suggestions;
DROP POLICY IF EXISTS "Authenticated users can view replenishment suggestions" ON public.replenishment_suggestions;

CREATE POLICY "Users can manage replenishment suggestions in their organization"
ON public.replenishment_suggestions
FOR ALL
TO authenticated
USING (organization_id = get_current_organization_safe())
WITH CHECK (organization_id = get_current_organization_safe());

-- Step 7: Create RLS policies for replenishment_config (update existing)
DROP POLICY IF EXISTS "Admins and designers can manage replenishment config" ON public.replenishment_config;
DROP POLICY IF EXISTS "Authenticated users can view replenishment config" ON public.replenishment_config;

CREATE POLICY "Users can manage replenishment config in their organization"
ON public.replenishment_config
FOR ALL
TO authenticated
USING (organization_id = get_current_organization_safe())
WITH CHECK (organization_id = get_current_organization_safe());

-- Step 8: Create RLS policies for sales_metrics (update existing)
DROP POLICY IF EXISTS "Authenticated users can view sales metrics" ON public.sales_metrics;
DROP POLICY IF EXISTS "System can manage sales metrics" ON public.sales_metrics;

CREATE POLICY "Users can view sales metrics in their organization"
ON public.sales_metrics
FOR SELECT
TO authenticated
USING (organization_id = get_current_organization_safe());

CREATE POLICY "System can manage sales metrics"
ON public.sales_metrics
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 9: Add triggers to auto-set organization_id
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_safe();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for auto-setting organization_id
DROP TRIGGER IF EXISTS set_organization_id_replenishment_suggestions ON public.replenishment_suggestions;
CREATE TRIGGER set_organization_id_replenishment_suggestions
  BEFORE INSERT ON public.replenishment_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_organization_id_replenishment_config ON public.replenishment_config;
CREATE TRIGGER set_organization_id_replenishment_config
  BEFORE INSERT ON public.replenishment_config
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

DROP TRIGGER IF EXISTS set_organization_id_sales_metrics ON public.sales_metrics;
CREATE TRIGGER set_organization_id_sales_metrics
  BEFORE INSERT ON public.sales_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- Step 10: Update calculate_replenishment_suggestions function to use organization_id properly
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
 RETURNS void
 LANGUAGE plpgsql
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
  lead_time_days INTEGER := 30; -- Lead time actualizado a 30 días
  safety_days INTEGER := 10; -- Safety days actualizado a 10 días
  target_stock_days INTEGER;
  current_org_id UUID;
BEGIN
  current_org_id := get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;
  
  target_stock_days := lead_time_days + safety_days; -- 40 días total

  RAISE NOTICE 'Iniciando cálculo de reposición para organización % con lead time: % días, safety: % días (total: % días)', 
    current_org_id, lead_time_days, safety_days, target_stock_days;

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
      ELSE 9999 -- Si no hay ventas, consideramos stock infinito
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
    -- Stock objetivo = demanda proyectada + órdenes pendientes - stock actual
    suggested_qty := GREATEST(0, projected_demand + open_orders_qty - rec.current_stock);

    -- Determinar nivel de urgencia con los nuevos parámetros
    IF days_remaining <= (lead_time_days * 0.5) THEN -- Menos de 15 días (50% del lead time)
      urgency := 'critical';
      reason_text := format('Stock crítico: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= 20 THEN -- Menos de 20 días
      urgency := 'high';
      reason_text := format('Stock bajo: %.1f días restantes (lead time %s días)', days_remaining, lead_time_days);
    ELSIF days_remaining <= target_stock_days THEN -- Menos del objetivo (40 días)
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

      RAISE NOTICE 'Variante %: Stock=%, Ventas30d=%, Velocidad=%.2f, Días=%.1f, Pendientes=%, Proyectado=%, Sugerido=%, Urgencia=%', 
        rec.sku_variant, rec.current_stock, sales_30_days, sales_velocity, days_remaining, 
        open_orders_qty, projected_demand, suggested_qty, urgency;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Cálculo de reposición completado para organización % con nuevos parámetros: lead time % días, safety % días', 
    current_org_id, lead_time_days, safety_days;
END;
$function$;