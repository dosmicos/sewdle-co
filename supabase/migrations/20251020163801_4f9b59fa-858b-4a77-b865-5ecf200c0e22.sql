-- Corregir ambigüedad de current_stock en calculate_replenishment_suggestions
-- Eliminar RETURNING ... INTO y usar RETURN QUERY SELECT

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
RETURNS TABLE (
  product_variant_id UUID,
  current_stock INTEGER,
  sales_velocity NUMERIC,
  days_of_stock NUMERIC,
  open_orders_quantity INTEGER,
  projected_demand NUMERIC,
  suggested_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_calculation_date DATE := CURRENT_DATE;
  v_organization_id UUID;
  v_total_variants INTEGER := 0;
BEGIN
  v_organization_id := get_current_organization_safe();
  
  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  -- Eliminar sugerencias anteriores del día actual
  DELETE FROM replenishment_suggestions 
  WHERE calculation_date = v_calculation_date 
    AND organization_id = v_organization_id;

  -- Insertar nuevas sugerencias sin RETURNING
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
    status
  )
  WITH calculations AS (
    SELECT 
      pv.id AS variant_id,
      pv.stock_quantity AS current_stock,
      
      -- Calcular velocidad de ventas (últimos 30 días)
      COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = v_organization_id
          AND DATE(so.created_at_shopify) >= v_calculation_date - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid', 'pending')
      ), 0) / 30.0 AS sales_velocity,
      
      -- Días de stock restantes
      CASE 
        WHEN COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = v_organization_id
            AND DATE(so.created_at_shopify) >= v_calculation_date - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid', 'pending')
        ), 0) / 30.0 > 0 
        THEN pv.stock_quantity / (COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = v_organization_id
            AND DATE(so.created_at_shopify) >= v_calculation_date - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid', 'pending')
        ), 0) / 30.0)
        ELSE 999
      END AS days_of_stock,
      
      -- Pedidos abiertos
      COALESCE((
        SELECT SUM(oi.quantity - COALESCE(di_sum.delivered, 0))
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN LATERAL (
          SELECT SUM(di.quantity_delivered) as delivered
          FROM delivery_items di
          JOIN deliveries d ON di.delivery_id = d.id
          WHERE di.order_item_id = oi.id
            AND d.status IN ('approved', 'in_quality')
        ) di_sum ON true
        WHERE oi.product_variant_id = pv.id
          AND o.status IN ('pending', 'assigned', 'in_production')
          AND o.organization_id = v_organization_id
      ), 0) AS open_orders,
      
      -- Demanda proyectada (próximos 30 días)
      GREATEST(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = v_organization_id
            AND DATE(so.created_at_shopify) >= v_calculation_date - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid', 'pending')
        ), 0) / 30.0 * 30,
        10
      ) AS projected_demand
      
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = v_organization_id
      AND pv.sku_variant IS NOT NULL
      AND pv.sku_variant != ''
  )
  SELECT 
    c.variant_id,
    v_organization_id,
    v_calculation_date,
    c.current_stock,
    c.sales_velocity,
    c.days_of_stock,
    c.open_orders,
    c.projected_demand,
    
    -- Cantidad sugerida
    GREATEST(
      0,
      CEIL(c.projected_demand + c.open_orders - c.current_stock)
    )::INTEGER AS suggested_qty,
    
    -- Nivel de urgencia
    CASE 
      WHEN c.days_of_stock < 7 THEN 'critical'
      WHEN c.days_of_stock < 14 THEN 'high'
      WHEN c.days_of_stock < 30 THEN 'normal'
      ELSE 'low'
    END AS urgency,
    
    -- Razón
    CASE 
      WHEN c.days_of_stock < 7 THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN c.days_of_stock < 14 THEN 'Stock bajo: menos de 14 días de inventario'
      WHEN c.days_of_stock < 30 THEN 'Reposición normal: menos de 30 días de inventario'
      ELSE 'Stock suficiente'
    END AS reason,
    
    'pending'
    
  FROM calculations c
  WHERE GREATEST(0, CEIL(c.projected_demand + c.open_orders - c.current_stock)) > 0;

  -- Obtener el número de filas insertadas
  GET DIAGNOSTICS v_total_variants = ROW_COUNT;

  RAISE NOTICE 'Procesadas % variantes, generadas % sugerencias', v_total_variants, v_total_variants;

  -- Retornar los datos insertados usando RETURN QUERY SELECT
  RETURN QUERY
  SELECT 
    rs.product_variant_id,
    rs.current_stock,
    rs.sales_velocity,
    rs.days_of_stock,
    rs.open_orders_quantity,
    rs.projected_demand,
    rs.suggested_quantity,
    rs.urgency_level,
    rs.reason
  FROM replenishment_suggestions rs
  WHERE rs.calculation_date = v_calculation_date
    AND rs.organization_id = v_organization_id
  ORDER BY 
    CASE rs.urgency_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    rs.suggested_quantity DESC;
    
END;
$function$;