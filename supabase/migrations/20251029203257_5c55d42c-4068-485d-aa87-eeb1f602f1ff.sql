-- ============================================================================
-- REFRESH INVENTORY REPLENISHMENT - VERSIÓN CORREGIDA DESDE CERO
-- ============================================================================
-- Esta función calcula sugerencias de reposición basadas en:
-- 1. Stock actual de product_variants (stock_quantity)
-- 2. Producción pendiente de orders
-- 3. Ventas de los últimos 30 días de shopify_orders
-- ============================================================================

DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
  v_calculation_date DATE := CURRENT_DATE;
BEGIN
  -- Eliminar cálculos anteriores del día actual para evitar duplicados
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = v_calculation_date;

  -- Insertar nuevos cálculos de reposición
  WITH sales_data AS (
    -- Calcular ventas de los últimos 30 días desde Shopify
    SELECT 
      soli.sku,
      COUNT(DISTINCT so.shopify_order_id) as orders_count,
      SUM(soli.quantity) as total_sales
    FROM shopify_order_line_items soli
    JOIN shopify_orders so ON soli.shopify_order_id = so.id
    WHERE so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid')
      AND so.cancelled_at IS NULL
    GROUP BY soli.sku
  ),
  pending_production AS (
    -- Calcular producción pendiente
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_quantity
    FROM product_variants pv
    LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
    LEFT JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production')
    GROUP BY pv.id
  ),
  variant_metrics AS (
    -- Combinar todas las métricas por variante
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.sku_variant,
      pv.size,
      pv.color,
      COALESCE(pv.stock_quantity, 0) as current_stock,
      COALESCE(pp.pending_quantity, 0) as pending_production,
      COALESCE(sd.total_sales, 0) as sales_30d,
      COALESCE(sd.orders_count, 0) as orders_count_30d,
      COALESCE(sd.total_sales, 0) / 30.0 as avg_daily_sales
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sd ON pv.sku_variant = sd.sku
    LEFT JOIN pending_production pp ON pv.id = pp.variant_id
    WHERE p.organization_id = org_id
      AND pv.sku_variant IS NOT NULL
      AND pv.sku_variant != ''
  )
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
    calculation_date,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_demand_40d,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status
  )
  SELECT 
    org_id,
    vm.variant_id,
    v_calculation_date,
    vm.current_stock,
    vm.pending_production,
    vm.sales_30d,
    vm.orders_count_30d,
    vm.avg_daily_sales,
    -- Days of supply
    CASE 
      WHEN vm.avg_daily_sales > 0 
      THEN vm.current_stock / vm.avg_daily_sales
      ELSE NULL
    END as days_of_supply,
    -- Projected demand for next 40 days
    CEIL(vm.avg_daily_sales * 40) as projected_demand_40d,
    -- Suggested quantity
    GREATEST(0, 
      CEIL(vm.avg_daily_sales * 40) - vm.current_stock - vm.pending_production
    ) as suggested_quantity,
    -- Urgency level
    CASE
      WHEN vm.current_stock = 0 AND vm.sales_30d > 0 THEN 'critical'
      WHEN vm.current_stock < (vm.avg_daily_sales * 7) AND vm.sales_30d > 0 THEN 'high'
      WHEN vm.current_stock < (vm.avg_daily_sales * 14) AND vm.sales_30d > 0 THEN 'medium'
      ELSE 'low'
    END as urgency,
    -- Reason
    CASE
      WHEN vm.current_stock = 0 AND vm.sales_30d > 0 
      THEN 'Stock agotado con ventas activas'
      WHEN vm.current_stock < (vm.avg_daily_sales * 7) AND vm.sales_30d > 0 
      THEN 'Menos de 7 días de inventario'
      WHEN vm.current_stock < (vm.avg_daily_sales * 14) AND vm.sales_30d > 0 
      THEN 'Menos de 14 días de inventario'
      ELSE 'Nivel de stock adecuado'
    END as reason,
    -- Data confidence
    CASE
      WHEN vm.orders_count_30d >= 10 THEN 'high'
      WHEN vm.orders_count_30d >= 3 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    'pending' as status
  FROM variant_metrics vm
  WHERE vm.sales_30d > 0  -- Solo productos con ventas
     OR vm.current_stock > 0  -- O que tengan stock
  ORDER BY 
    CASE
      WHEN vm.current_stock = 0 AND vm.sales_30d > 0 THEN 1
      WHEN vm.current_stock < (vm.avg_daily_sales * 7) THEN 2
      WHEN vm.current_stock < (vm.avg_daily_sales * 14) THEN 3
      ELSE 4
    END,
    vm.avg_daily_sales DESC;

  -- Obtener cantidad de registros insertados
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'calculation_date', v_calculation_date,
    'organization_id', org_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error en refresh_inventory_replenishment: %', SQLERRM;
END;
$$;