-- Fix sales velocity calculation by improving days_with_stock logic
-- to avoid division by 1 which makes velocity = sales_30_days

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE (
  variant_id UUID,
  product_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku_variant TEXT,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders INTEGER,
  projected_demand NUMERIC,
  suggested_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT,
  data_quality_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  sales_30_days INTEGER;
  days_with_stock INTEGER;
  snapshot_days INTEGER;
  velocity NUMERIC;
  stock_days NUMERIC;
  open_orders_qty INTEGER;
  projected_demand_qty NUMERIC;
  suggested_qty INTEGER;
  urgency TEXT;
  reason_text TEXT;
  data_quality_level TEXT;
  variant_age_days INTEGER;
BEGIN
  -- Iterar sobre todas las variantes activas
  FOR rec IN
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      pv.stock_quantity as current_stock,
      pv.created_at as variant_created_at,
      p.organization_id
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.status = 'active'
  LOOP
    -- Calcular edad de la variante en días
    variant_age_days := (CURRENT_DATE - DATE(rec.variant_created_at))::INTEGER;
    
    -- Calcular ventas de los últimos 30 días desde Shopify
    SELECT COALESCE(SUM(soli.quantity), 0)::INTEGER
    INTO sales_30_days
    FROM shopify_order_line_items soli
    JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    WHERE soli.sku = rec.sku_variant
      AND so.organization_id = rec.organization_id
      AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'pending');
    
    -- Contar días con stock basado en snapshots diarios
    SELECT COUNT(DISTINCT DATE(recorded_at))::INTEGER
    INTO days_with_stock
    FROM product_stock_history
    WHERE product_variant_id = rec.variant_id
      AND recorded_at >= CURRENT_DATE - INTERVAL '30 days'
      AND stock_quantity > 0;
    
    -- Contar total de snapshots en los últimos 30 días
    SELECT COUNT(DISTINCT DATE(recorded_at))::INTEGER
    INTO snapshot_days
    FROM product_stock_history
    WHERE product_variant_id = rec.variant_id
      AND recorded_at >= CURRENT_DATE - INTERVAL '30 days';
    
    -- Determinar calidad de datos y days_with_stock mejorado
    IF snapshot_days >= 25 THEN
      -- Alta calidad: tenemos snapshots diarios confiables
      data_quality_level := 'high';
      -- days_with_stock ya está calculado correctamente
    ELSIF days_with_stock >= 7 THEN
      -- Calidad media: tenemos al menos 7 días de datos reales
      data_quality_level := 'medium';
      -- days_with_stock ya está calculado correctamente
    ELSIF days_with_stock > 0 AND days_with_stock < 7 THEN
      -- Datos insuficientes pero algunos registros: usar 30 días como estimación conservadora
      data_quality_level := 'low';
      days_with_stock := 30; -- Asumir disponibilidad completa del período
    ELSIF rec.current_stock > 0 AND variant_age_days > 0 THEN
      -- Sin datos históricos pero con stock actual: estimar basado en edad
      data_quality_level := 'low';
      -- Usar la edad del producto, pero mínimo 7 días para evitar velocidades infladas
      days_with_stock := GREATEST(7, LEAST(30, variant_age_days));
    ELSIF sales_30_days > 0 THEN
      -- Tenemos ventas pero no datos de stock: usar 30 días como estimación
      data_quality_level := 'low';
      days_with_stock := 30;
    ELSE
      -- Sin datos suficientes para calcular
      data_quality_level := 'insufficient';
      days_with_stock := NULL;
    END IF;
    
    -- Calcular velocidad de ventas (unidades/día) con protección contra división por cero
    IF days_with_stock > 0 THEN
      velocity := sales_30_days::NUMERIC / days_with_stock::NUMERIC;
    ELSE
      velocity := 0;
    END IF;
    
    -- Calcular días de stock restante
    IF velocity > 0 THEN
      stock_days := rec.current_stock::NUMERIC / velocity;
    ELSE
      stock_days := 999; -- Stock suficiente si no hay ventas
    END IF;
    
    -- Calcular cantidad en órdenes abiertas
    SELECT COALESCE(SUM(oi.quantity), 0)::INTEGER
    INTO open_orders_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = rec.variant_id
      AND o.status IN ('pending', 'assigned', 'in_production');
    
    -- Proyectar demanda para los próximos 30 días
    projected_demand_qty := CEIL(velocity * 30);
    
    -- Calcular cantidad sugerida
    suggested_qty := GREATEST(0, projected_demand_qty - rec.current_stock - open_orders_qty);
    
    -- Determinar nivel de urgencia
    IF stock_days <= 7 AND velocity > 0 THEN
      urgency := 'critical';
      reason_text := format('Stock crítico: solo quedan %.1f días de inventario', stock_days);
    ELSIF stock_days <= 14 AND velocity > 0 THEN
      urgency := 'high';
      reason_text := format('Stock bajo: quedan %.1f días de inventario', stock_days);
    ELSIF stock_days <= 30 AND velocity > 0 THEN
      urgency := 'normal';
      reason_text := format('Reposición normal: %.1f días de inventario', stock_days);
    ELSE
      urgency := 'low';
      reason_text := 'Stock suficiente o sin movimiento';
    END IF;
    
    -- Solo retornar si hay sugerencia significativa o es urgente
    IF suggested_qty > 0 OR urgency IN ('critical', 'high') THEN
      -- Insertar o actualizar en replenishment_suggestions
      INSERT INTO replenishment_suggestions (
        product_variant_id,
        organization_id,
        calculation_date,
        current_stock,
        sales_velocity,
        days_of_stock,
        open_orders_quantity,
        projected_demand,
        suggested_quantity,
        urgency_level,
        reason,
        status,
        data_quality_level
      ) VALUES (
        rec.variant_id,
        rec.organization_id,
        CURRENT_DATE,
        rec.current_stock,
        velocity,
        stock_days,
        open_orders_qty,
        projected_demand_qty,
        suggested_qty,
        urgency,
        reason_text,
        'pending',
        data_quality_level
      )
      ON CONFLICT (product_variant_id, organization_id, calculation_date)
      DO UPDATE SET
        current_stock = EXCLUDED.current_stock,
        sales_velocity = EXCLUDED.sales_velocity,
        days_of_stock = EXCLUDED.days_of_stock,
        open_orders_quantity = EXCLUDED.open_orders_quantity,
        projected_demand = EXCLUDED.projected_demand,
        suggested_quantity = EXCLUDED.suggested_quantity,
        urgency_level = EXCLUDED.urgency_level,
        reason = EXCLUDED.reason,
        data_quality_level = EXCLUDED.data_quality_level,
        updated_at = now();
      
      -- Retornar resultado
      RETURN QUERY SELECT
        rec.variant_id,
        rec.product_name,
        rec.variant_size,
        rec.variant_color,
        rec.sku_variant,
        rec.current_stock,
        velocity,
        stock_days,
        open_orders_qty,
        projected_demand_qty,
        suggested_qty,
        urgency,
        reason_text,
        data_quality_level;
    END IF;
  END LOOP;
END;
$$;