
-- Mejorar la función calculate_replenishment_suggestions para usar cantidades pendientes reales
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
    -- Calcular velocidad de ventas usando datos reales de Shopify (últimos 30 días)
    SELECT COALESCE(SUM(sm.sales_quantity), 0) / 30.0 INTO velocity
    FROM public.sales_metrics sm
    WHERE sm.product_variant_id = rec.id
    AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Calcular días de stock disponible
    IF velocity > 0 THEN
      days_stock := rec.stock / velocity;
    ELSE
      days_stock := 999; -- Stock infinito si no hay ventas
    END IF;
    
    -- MEJORA CRÍTICA: Calcular cantidades pendientes reales (no órdenes completas)
    -- Sumar todas las cantidades ordenadas menos las ya aprobadas para esta variante
    SELECT COALESCE(SUM(
      oi.quantity - COALESCE((
        SELECT SUM(di.quantity_approved)
        FROM public.delivery_items di
        INNER JOIN public.deliveries d ON di.delivery_id = d.id
        WHERE di.order_item_id = oi.id
        AND d.order_id = o.id
      ), 0)
    ), 0) INTO open_qty
    FROM public.order_items oi
    INNER JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = rec.id
    AND o.status IN ('pending', 'assigned', 'in_progress')
    -- Solo contar cantidades positivas pendientes
    AND (oi.quantity - COALESCE((
      SELECT SUM(di.quantity_approved)
      FROM public.delivery_items di
      INNER JOIN public.deliveries d ON di.delivery_id = d.id
      WHERE di.order_item_id = oi.id
      AND d.order_id = o.id
    ), 0)) > 0;
    
    -- Calcular lead time total
    total_lead_time := rec.lead_days + rec.safety_days;
    
    -- Proyectar demanda para el período de lead time basado en VENTAS REALES
    demand := CEIL(velocity * total_lead_time);
    
    -- Calcular sugerencia de reposición
    suggestion := GREATEST(0, demand + rec.min_stock - rec.stock - open_qty);
    
    -- Determinar nivel de urgencia
    IF days_stock <= 7 THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: solo %s días de inventario (ventas: %s/día, pendientes: %s unidades)', 
        ROUND(days_stock, 1), ROUND(velocity, 2), open_qty);
    ELSIF days_stock <= 15 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %s días de inventario (ventas: %s/día, pendientes: %s unidades)', 
        ROUND(days_stock, 1), ROUND(velocity, 2), open_qty);
    ELSIF suggestion > 0 THEN
      urgency := 'normal';
      reason_text := format('Reposición normal: velocidad %s/día, lead time %s días, pendientes %s unidades', 
        ROUND(velocity, 2), total_lead_time, open_qty);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %s días de inventario (ventas: %s/día, pendientes: %s unidades)', 
        ROUND(days_stock, 1), ROUND(velocity, 2), open_qty);
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
$function$;
