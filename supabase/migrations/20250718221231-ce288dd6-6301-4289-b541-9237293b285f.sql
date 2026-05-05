-- Mejorar la función de cálculo de reposición para mejor limpieza de duplicados
CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders integer,
  projected_demand integer,
  suggested_quantity integer,
  urgency_level text,
  reason text
)
LANGUAGE plpgsql
AS $function$
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
  -- Limpiar todas las sugerencias anteriores (no solo del día actual)
  DELETE FROM public.replenishment_suggestions WHERE calculation_date <= CURRENT_DATE;
  
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
      COALESCE(rc.safety_stock_days, 7) as safety_days_config
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    LEFT JOIN public.replenishment_config rc ON pv.id = rc.product_variant_id
    WHERE p.status = 'active'
  LOOP
    -- Calcular velocidad de ventas (últimos 30 días)
    SELECT COALESCE(SUM(sales_quantity), 0) / 30.0
    INTO velocity
    FROM public.sales_metrics sm
    WHERE sm.product_variant_id = rec.id
    AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Calcular días de stock disponible
    IF velocity > 0 THEN
      days_stock := rec.stock / velocity;
    ELSE
      days_stock := 999; -- Stock indefinido si no hay ventas
    END IF;
    
    -- Calcular cantidad en órdenes abiertas (mejorado)
    SELECT COALESCE(SUM(oi.quantity - COALESCE(approved_qty.total_approved, 0)), 0)
    INTO open_qty
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
    ) approved_qty ON oi.id = approved_qty.order_item_id
    WHERE oi.product_variant_id = rec.id
    AND o.status IN ('pending', 'assigned', 'in_progress');
    
    -- Calcular tiempo total de entrega
    lead_time := rec.lead_days;
    safety_days := rec.safety_days_config;
    total_lead_time := lead_time + safety_days;
    
    -- Proyectar demanda para el tiempo de entrega + seguridad
    demand := CEIL(velocity * total_lead_time);
    
    -- Calcular cantidad sugerida
    suggestion := GREATEST(0, demand - rec.stock - open_qty);
    
    -- Determinar nivel de urgencia
    IF days_stock <= 3 OR rec.stock <= 0 THEN
      urgency := 'critical';
      reason_text := 'Stock crítico';
    ELSIF days_stock <= 7 THEN
      urgency := 'high';
      reason_text := 'Stock bajo';
    ELSIF suggestion > 0 THEN
      urgency := 'normal';
      reason_text := 'Reposición preventiva';
    ELSE
      urgency := 'low';
      reason_text := 'Stock suficiente';
    END IF;
    
    -- Insertar sugerencia solo si hay recomendación o es crítica/alta
    IF suggestion > 0 OR urgency IN ('critical', 'high') THEN
      INSERT INTO public.replenishment_suggestions (
        product_variant_id,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        projected_demand,
        suggested_quantity,
        urgency_level,
        reason,
        calculation_date,
        status
      ) VALUES (
        rec.id,
        rec.stock,
        ROUND(velocity, 3),
        ROUND(days_stock, 1),
        open_qty,
        demand,
        suggestion,
        urgency,
        reason_text,
        CURRENT_DATE,
        'pending'
      );
    END IF;
    
    -- Retornar fila para el resultado
    variant_id := rec.id;
    product_name := rec.product_name;
    variant_size := rec.size;
    variant_color := rec.color;
    sku_variant := rec.sku_variant;
    current_stock := rec.stock;
    sales_velocity := ROUND(velocity, 3);
    days_of_stock := ROUND(days_stock, 1);
    open_orders := open_qty;
    projected_demand := demand;
    suggested_quantity := suggestion;
    urgency_level := urgency;
    reason := reason_text;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$function$;