
-- Corregir la función calculate_replenishment_suggestions para usar sales_metrics y mejorar la lógica
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
  -- Limpiar todas las sugerencias anteriores
  DELETE FROM public.replenishment_suggestions WHERE calculation_date <= CURRENT_DATE;
  
  -- Iterar sobre todas las variantes activas
  FOR rec IN 
    SELECT 
      pv.id,
      p.name as product_name,
      pv.size,
      pv.color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as stock,
      -- Usar valores por defecto si no hay configuración
      COALESCE(rc.lead_time_days, 15) as lead_days,
      COALESCE(rc.safety_days, 15) as safety_days_config,
      COALESCE(rc.min_stock_level, 5) as min_stock,
      COALESCE(rc.max_stock_level, 50) as max_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    LEFT JOIN public.replenishment_config rc ON pv.id = rc.product_variant_id AND rc.is_active = true
    WHERE p.status = 'active'
  LOOP
    -- CORRECCIÓN CLAVE: Calcular velocidad usando sales_metrics (datos de Shopify)
    SELECT COALESCE(SUM(sm.sales_quantity), 0) / 30.0
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
    
    -- CORRECCIÓN: Proyectar demanda para el tiempo de entrega + seguridad
    demand := CEIL(velocity * total_lead_time);
    
    -- CORRECCIÓN CLAVE: Mejorar cálculo de cantidad sugerida
    -- Para productos con stock 0 y ventas, siempre sugerir al menos la demanda proyectada
    IF rec.stock = 0 AND velocity > 0 THEN
      -- Stock crítico con ventas: sugerir demanda + buffer mínimo
      suggestion := GREATEST(demand + rec.min_stock, CEIL(velocity * 30)); -- Mínimo 30 días de stock
    ELSIF rec.stock < rec.min_stock AND velocity > 0 THEN
      -- Stock bajo: completar hasta nivel óptimo
      suggestion := GREATEST(0, (demand + rec.min_stock) - rec.stock - open_qty);
    ELSE
      -- Cálculo normal
      suggestion := GREATEST(0, demand - rec.stock - open_qty);
    END IF;
    
    -- CORRECCIÓN: Mejorar determinación de nivel de urgencia
    IF rec.stock = 0 AND velocity > 0 THEN
      urgency := 'critical';
      reason_text := format('STOCK AGOTADO - Ventas activas: %.2f/día, Órdenes pendientes: %s', velocity, open_qty);
    ELSIF days_stock <= 3 THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: solo %.1f días, Velocidad: %.2f/día', days_stock, velocity);
    ELSIF days_stock <= 7 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: %.1f días disponibles, Velocidad: %.2f/día', days_stock, velocity);
    ELSIF suggestion > 0 THEN
      urgency := 'normal';
      reason_text := format('Reposición preventiva - Demanda proyectada: %s, Lead time: %s días', demand, total_lead_time);
    ELSE
      urgency := 'low';
      reason_text := format('Stock suficiente: %.1f días disponibles', days_stock);
    END IF;
    
    -- CORRECCIÓN: Insertar sugerencia si hay recomendación O es crítica/alta
    -- Siempre insertar productos con stock 0 y ventas recientes
    IF suggestion > 0 OR urgency IN ('critical', 'high') OR (rec.stock = 0 AND velocity > 0) THEN
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
