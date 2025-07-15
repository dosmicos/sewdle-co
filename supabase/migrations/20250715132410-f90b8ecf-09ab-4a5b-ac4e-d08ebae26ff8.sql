-- Crear tablas para el módulo de reposición inteligente

-- Tabla de configuración de reposición
CREATE TABLE public.replenishment_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  max_stock_level INTEGER NOT NULL DEFAULT 100,
  lead_time_days INTEGER NOT NULL DEFAULT 15,
  safety_days INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Tabla de sugerencias de reposición
CREATE TABLE public.replenishment_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  suggested_quantity INTEGER NOT NULL,
  current_stock INTEGER NOT NULL DEFAULT 0,
  sales_velocity NUMERIC(10,2) NOT NULL DEFAULT 0,
  days_of_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
  open_orders_quantity INTEGER NOT NULL DEFAULT 0,
  projected_demand INTEGER NOT NULL DEFAULT 0,
  urgency_level TEXT NOT NULL DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'critical')),
  reason TEXT,
  calculation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de métricas de ventas (para cálculos históricos)
CREATE TABLE public.sales_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sales_quantity INTEGER NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  avg_order_size NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_variant_id, metric_date)
);

-- Índices para mejorar performance
CREATE INDEX idx_replenishment_config_variant ON public.replenishment_config(product_variant_id);
CREATE INDEX idx_replenishment_config_active ON public.replenishment_config(is_active);
CREATE INDEX idx_replenishment_suggestions_variant ON public.replenishment_suggestions(product_variant_id);
CREATE INDEX idx_replenishment_suggestions_date ON public.replenishment_suggestions(calculation_date);
CREATE INDEX idx_replenishment_suggestions_status ON public.replenishment_suggestions(status);
CREATE INDEX idx_sales_metrics_variant_date ON public.sales_metrics(product_variant_id, metric_date);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_replenishment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_replenishment_config_updated_at
  BEFORE UPDATE ON public.replenishment_config
  FOR EACH ROW EXECUTE FUNCTION public.update_replenishment_updated_at();

CREATE TRIGGER update_replenishment_suggestions_updated_at
  BEFORE UPDATE ON public.replenishment_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_replenishment_updated_at();

-- Función para calcular sugerencias de reposición
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE(
  variant_id UUID,
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders INTEGER,
  projected_demand INTEGER,
  suggested_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  velocity NUMERIC;
  days_stock NUMERIC;
  open_qty INTEGER;
  demand INTEGER;
  suggestion INTEGER;
  urgency TEXT;
  reason_text TEXT;
  lead_time INTEGER;
  safety_days INTEGER;
  total_lead_time INTEGER;
BEGIN
  -- Limpiar sugerencias del día actual
  DELETE FROM public.replenishment_suggestions WHERE calculation_date = CURRENT_DATE;
  
  -- Iterar sobre todas las variantes activas con configuración
  FOR rec IN 
    SELECT 
      pv.id,
      p.name as product_name,
      pv.size,
      pv.color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as stock,
      COALESCE(rc.lead_time_days, 15) as lead_days,
      COALESCE(rc.safety_days, 15) as safety_days,
      COALESCE(rc.min_stock_level, 0) as min_stock,
      COALESCE(rc.max_stock_level, 100) as max_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    LEFT JOIN public.replenishment_config rc ON pv.id = rc.product_variant_id AND rc.is_active = true
    WHERE p.status = 'active'
  LOOP
    -- Calcular velocidad de venta (últimos 30 días)
    SELECT COALESCE(AVG(oi.quantity), 0) INTO velocity
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = rec.id
    AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND o.status IN ('pending', 'assigned', 'in_progress', 'completed');
    
    -- Calcular días de stock disponible
    IF velocity > 0 THEN
      days_stock := rec.stock / velocity;
    ELSE
      days_stock := 999; -- Stock infinito si no hay ventas
    END IF;
    
    -- Calcular órdenes abiertas
    SELECT COALESCE(SUM(oi.quantity), 0) INTO open_qty
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = rec.id
    AND o.status IN ('pending', 'assigned', 'in_progress');
    
    -- Calcular lead time total
    total_lead_time := rec.lead_days + rec.safety_days;
    
    -- Proyectar demanda para el período de lead time
    demand := CEIL(velocity * total_lead_time);
    
    -- Calcular sugerencia de reposición
    suggestion := GREATEST(0, demand + rec.min_stock - rec.stock - open_qty);
    
    -- Determinar nivel de urgencia
    IF days_stock <= 7 THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: solo %s días de inventario', ROUND(days_stock, 1));
    ELSIF days_stock <= 15 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %s días de inventario', ROUND(days_stock, 1));
    ELSIF suggestion > 0 THEN
      urgency := 'normal';
      reason_text := format('Reposición normal: velocidad %s/día, lead time %s días', ROUND(velocity, 2), total_lead_time);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %s días de inventario', ROUND(days_stock, 1));
    END IF;
    
    -- Insertar sugerencia solo si hay algo que sugerir o es urgente
    IF suggestion > 0 OR urgency IN ('critical', 'high') THEN
      INSERT INTO public.replenishment_suggestions (
        product_variant_id,
        suggested_quantity,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        projected_demand,
        urgency_level,
        reason
      ) VALUES (
        rec.id,
        suggestion,
        rec.stock,
        velocity,
        days_stock,
        open_qty,
        demand,
        urgency,
        reason_text
      );
    END IF;
    
    -- Retornar fila para la consulta
    variant_id := rec.id;
    product_name := rec.product_name;
    variant_size := rec.size;
    variant_color := rec.color;
    sku_variant := rec.sku_variant;
    current_stock := rec.stock;
    sales_velocity := velocity;
    days_of_stock := days_stock;
    open_orders := open_qty;
    projected_demand := demand;
    suggested_quantity := suggestion;
    urgency_level := urgency;
    reason := reason_text;
    
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Función para obtener sugerencias de reposición con detalles
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id UUID,
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  suggested_quantity INTEGER,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders_quantity INTEGER,
  projected_demand INTEGER,
  urgency_level TEXT,
  reason TEXT,
  status TEXT,
  calculation_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    rs.id,
    p.name as product_name,
    pv.size as variant_size,
    pv.color as variant_color,
    pv.sku_variant,
    rs.suggested_quantity,
    rs.current_stock,
    rs.sales_velocity,
    rs.days_of_stock,
    rs.open_orders_quantity,
    rs.projected_demand,
    rs.urgency_level,
    rs.reason,
    rs.status,
    rs.calculation_date,
    rs.created_at
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
$$;

-- RLS Policies
ALTER TABLE public.replenishment_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replenishment_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para replenishment_config
CREATE POLICY "Authenticated users can view replenishment config" ON public.replenishment_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and designers can manage replenishment config" ON public.replenishment_config
  FOR ALL USING (get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']));

-- Políticas para replenishment_suggestions
CREATE POLICY "Authenticated users can view replenishment suggestions" ON public.replenishment_suggestions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and designers can manage replenishment suggestions" ON public.replenishment_suggestions
  FOR ALL USING (get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador']));

-- Políticas para sales_metrics
CREATE POLICY "Authenticated users can view sales metrics" ON public.sales_metrics
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage sales metrics" ON public.sales_metrics
  FOR ALL USING (true);