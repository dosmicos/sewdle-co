-- Drop y recrear la función de cálculo de reposición basada en product_variants
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders integer,
  projected_demand numeric,
  suggested_quantity integer,
  urgency_level text,
  reason text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_organization_id uuid := p_organization_id;
  calc_record RECORD;
BEGIN
  -- Verificar que tenemos una organización válida
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id es requerido';
  END IF;

  -- Limpiar sugerencias anteriores del día actual
  DELETE FROM replenishment_suggestions 
  WHERE organization_id = v_organization_id 
    AND calculation_date = CURRENT_DATE;

  -- Calcular y retornar sugerencias por variante
  FOR calc_record IN
    WITH sales_data AS (
      SELECT 
        oi.product_variant_id,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_sold,
        AVG(oi.quantity) as avg_quantity_per_order
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.organization_id = v_organization_id
        AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND o.status NOT IN ('cancelled')
      GROUP BY oi.product_variant_id
    ),
    open_orders_data AS (
      SELECT 
        oi.product_variant_id,
        SUM(oi.quantity) as pending_quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.organization_id = v_organization_id
        AND o.status IN ('pending', 'assigned', 'in_production')
      GROUP BY oi.product_variant_id
    )
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock,
      COALESCE(sd.total_sold / 30.0, 0) as sales_velocity,
      CASE 
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0 
        THEN COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)
        ELSE 999
      END as days_of_stock,
      COALESCE(ood.pending_quantity, 0) as open_orders,
      COALESCE(sd.total_sold / 30.0, 0) * 30 as projected_demand,
      CASE
        WHEN COALESCE(pv.stock_quantity, 0) <= 0 THEN 
          GREATEST(CEIL(COALESCE(sd.total_sold / 30.0, 0) * 30), 10)
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0 
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 7 THEN
          CEIL((COALESCE(sd.total_sold / 30.0, 0) * 30) - COALESCE(pv.stock_quantity, 0))
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 15 THEN
          CEIL((COALESCE(sd.total_sold / 30.0, 0) * 20) - COALESCE(pv.stock_quantity, 0))
        ELSE 0
      END as suggested_quantity,
      CASE
        WHEN COALESCE(pv.stock_quantity, 0) <= 0 THEN 'critical'
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0 
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 7 THEN 'high'
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 15 THEN 'normal'
        ELSE 'low'
      END as urgency_level,
      CASE
        WHEN COALESCE(pv.stock_quantity, 0) <= 0 THEN 
          'Stock agotado - reposición inmediata necesaria'
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0 
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 7 THEN
          format('Stock crítico: solo %.1f días de inventario restante', 
            COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0))
        WHEN COALESCE(sd.total_sold / 30.0, 0) > 0
          AND (COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0)) < 15 THEN
          format('Stock bajo: %.1f días de inventario restante',
            COALESCE(pv.stock_quantity, 0) / (sd.total_sold / 30.0))
        ELSE 'Stock suficiente'
      END as reason
    FROM product_variants pv
    JOIN products p ON p.id = pv.product_id
    LEFT JOIN sales_data sd ON sd.product_variant_id = pv.id
    LEFT JOIN open_orders_data ood ON ood.product_variant_id = pv.id
    WHERE p.organization_id = v_organization_id
      AND pv.stock_quantity IS NOT NULL
  LOOP
    -- Insertar sugerencia en la tabla
    INSERT INTO replenishment_suggestions (
      product_variant_id,
      organization_id,
      current_stock,
      sales_velocity,
      days_of_stock,
      open_orders_quantity,
      suggested_quantity,
      urgency_level,
      reason,
      calculation_date,
      status
    ) VALUES (
      calc_record.variant_id,
      v_organization_id,
      calc_record.current_stock,
      calc_record.sales_velocity,
      calc_record.days_of_stock,
      calc_record.open_orders,
      calc_record.suggested_quantity,
      calc_record.urgency_level,
      calc_record.reason,
      CURRENT_DATE,
      'pending'
    );

    -- Retornar el registro para la respuesta
    variant_id := calc_record.variant_id;
    product_name := calc_record.product_name;
    variant_size := calc_record.variant_size;
    variant_color := calc_record.variant_color;
    sku_variant := calc_record.sku_variant;
    current_stock := calc_record.current_stock;
    sales_velocity := calc_record.sales_velocity;
    days_of_stock := calc_record.days_of_stock;
    open_orders := calc_record.open_orders;
    projected_demand := calc_record.projected_demand;
    suggested_quantity := calc_record.suggested_quantity;
    urgency_level := calc_record.urgency_level;
    reason := calc_record.reason;
    
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;