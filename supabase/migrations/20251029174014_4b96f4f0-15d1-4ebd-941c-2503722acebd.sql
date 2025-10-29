-- Corregir JOIN en refresh_inventory_replenishment para usar SKU
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_count INTEGER := 0;
BEGIN
  -- Eliminar registros del día actual para recalcular
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = CURRENT_DATE;

  -- Calcular ventas de los últimos 30 días desde Shopify
  WITH sales_30d AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COUNT(DISTINCT DATE(so.created_at_shopify)) as active_days,
      COUNT(DISTINCT so.shopify_order_id) as orders_count
    FROM public.shopify_order_line_items soli
    JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    JOIN public.product_variants pv ON soli.sku = pv.sku_variant
    JOIN public.products p ON pv.product_id = p.id
    WHERE so.created_at_shopify >= (CURRENT_DATE - INTERVAL '30 days')
      AND so.financial_status IN ('paid', 'partially_paid')
      AND p.organization_id = org_id
    GROUP BY pv.id
  ),
  
  -- Stock actual de cada variante
  current_inventory AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.inventory_quantity, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
      AND pv.is_deleted = false
  ),
  
  -- Producción pendiente por variante
  pending_prod AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_production
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN deliveries d ON d.order_id = o.id AND d.status IN ('delivered', 'in_transit')
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production')
      AND d.id IS NULL
    GROUP BY oi.product_variant_id
  ),
  
  -- Calcular métricas y sugerencias
  replenishment_data AS (
    SELECT
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(ci.current_stock, 0) as current_stock,
      COALESCE(pp.pending_production, 0) as pending_production,
      COALESCE(s.sales_30d, 0) as sales_30d,
      COALESCE(s.orders_count, 0) as orders_count_30d,
      
      -- Promedio de ventas diarias
      CASE 
        WHEN COALESCE(s.active_days, 0) > 0 
        THEN COALESCE(s.sales_30d, 0)::numeric / s.active_days
        ELSE 0
      END as avg_daily_sales,
      
      -- Días de inventario disponible
      CASE 
        WHEN COALESCE(s.sales_30d, 0) > 0 
        THEN (COALESCE(ci.current_stock, 0) + COALESCE(pp.pending_production, 0)) * 30.0 / s.sales_30d
        ELSE NULL
      END as days_of_supply,
      
      -- Demanda proyectada a 30 días
      CASE 
        WHEN COALESCE(s.active_days, 0) > 0 
        THEN CEIL(COALESCE(s.sales_30d, 0)::numeric / s.active_days * 30)
        ELSE 0
      END as projected_30d_demand,
      
      org_id as organization_id
      
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_30d s ON s.variant_id = pv.id
    LEFT JOIN current_inventory ci ON ci.variant_id = pv.id
    LEFT JOIN pending_prod pp ON pp.variant_id = pv.id
    WHERE p.organization_id = org_id
      AND pv.is_deleted = false
      AND COALESCE(s.sales_30d, 0) > 0  -- Solo productos con ventas
  )
  
  -- Insertar registros con lógica de urgencia y cantidad sugerida
  INSERT INTO inventory_replenishment (
    variant_id,
    organization_id,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status,
    calculation_date
  )
  SELECT
    variant_id,
    organization_id,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    
    -- Cantidad sugerida: demanda proyectada - (stock actual + pendiente)
    GREATEST(0, projected_30d_demand - (current_stock + pending_production)) as suggested_quantity,
    
    -- Urgencia basada en días de inventario
    CASE
      WHEN days_of_supply IS NULL OR days_of_supply <= 7 THEN 'critical'
      WHEN days_of_supply <= 14 THEN 'high'
      WHEN days_of_supply <= 21 THEN 'medium'
      ELSE 'low'
    END as urgency,
    
    -- Razón de la sugerencia
    CASE
      WHEN days_of_supply IS NULL THEN 'Sin inventario disponible'
      WHEN days_of_supply <= 7 THEN format('Solo %s días de inventario', ROUND(days_of_supply, 1))
      WHEN days_of_supply <= 14 THEN format('Inventario bajo: %s días', ROUND(days_of_supply, 1))
      WHEN days_of_supply <= 21 THEN format('Reabastecer pronto: %s días', ROUND(days_of_supply, 1))
      ELSE format('Inventario adecuado: %s días', ROUND(days_of_supply, 1))
    END as reason,
    
    -- Confianza basada en días activos de venta
    CASE
      WHEN orders_count_30d >= 10 THEN 'high'
      WHEN orders_count_30d >= 5 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    
    'pending' as status,
    CURRENT_DATE as calculation_date
    
  FROM replenishment_data
  WHERE projected_30d_demand > (current_stock + pending_production);  -- Solo si hay necesidad
  
  GET DIAGNOSTICS result_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', result_count,
    'calculation_date', CURRENT_DATE
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'inserted', 0
  );
END;
$$;