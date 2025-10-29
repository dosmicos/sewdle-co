-- Corrección del CTE current_inventory en refresh_inventory_replenishment
-- Usar stock_quantity de product_variants en lugar de shopify_inventory que no existe

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- CTE para obtener stock actual desde product_variants
  WITH current_inventory AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  
  -- CTE para calcular producción pendiente
  pending_production AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity - COALESCE(di.quantity_delivered, 0)), 0) as pending_qty
    FROM workshop_assignments wa
    JOIN orders o ON wa.order_id = o.id
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN delivery_items di ON oi.id = di.order_item_id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_production')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE para ventas de últimos 30 días
  sales_30d AS (
    SELECT 
      product_variant_id as variant_id,
      COALESCE(SUM(quantity_sold), 0) as total_sales,
      COUNT(DISTINCT DATE(sale_date)) as days_with_sales,
      COUNT(DISTINCT order_id) as orders_count
    FROM sales_metrics
    WHERE organization_id = org_id
      AND sale_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY product_variant_id
  ),
  
  -- Cálculo de sugerencias
  suggestions AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      p.sku,
      pv.sku_variant,
      pv.size as variant_size,
      pv.color as variant_color,
      ci.current_stock,
      pp.pending_qty as pending_production,
      s30.total_sales as sales_30d,
      s30.orders_count as orders_count_30d,
      CASE 
        WHEN s30.days_with_sales > 0 THEN s30.total_sales::NUMERIC / s30.days_with_sales
        ELSE 0
      END as avg_daily_sales,
      CASE 
        WHEN s30.days_with_sales > 0 AND s30.total_sales > 0 
        THEN (ci.current_stock + pp.pending_qty) / (s30.total_sales::NUMERIC / s30.days_with_sales)
        ELSE NULL
      END as days_of_supply,
      CASE 
        WHEN s30.days_with_sales > 0 
        THEN CEIL((s30.total_sales::NUMERIC / s30.days_with_sales) * 30)
        ELSE 0
      END as projected_30d_demand,
      CASE 
        WHEN s30.days_with_sales > 0 
        THEN GREATEST(0, CEIL((s30.total_sales::NUMERIC / s30.days_with_sales) * 30) - (ci.current_stock + pp.pending_qty))
        ELSE 0
      END as suggested_quantity,
      CASE 
        WHEN (ci.current_stock + pp.pending_qty) <= 0 AND s30.total_sales > 0 THEN 'critical'
        WHEN s30.days_with_sales > 0 AND (ci.current_stock + pp.pending_qty) / (s30.total_sales::NUMERIC / s30.days_with_sales) < 7 THEN 'high'
        WHEN s30.days_with_sales > 0 AND (ci.current_stock + pp.pending_qty) / (s30.total_sales::NUMERIC / s30.days_with_sales) < 14 THEN 'medium'
        ELSE 'low'
      END as urgency,
      CASE 
        WHEN (ci.current_stock + pp.pending_qty) <= 0 AND s30.total_sales > 0 THEN 'Sin stock y con ventas recientes'
        WHEN s30.days_with_sales > 0 AND (ci.current_stock + pp.pending_qty) / (s30.total_sales::NUMERIC / s30.days_with_sales) < 7 THEN 'Stock crítico: menos de 7 días'
        WHEN s30.days_with_sales > 0 AND (ci.current_stock + pp.pending_qty) / (s30.total_sales::NUMERIC / s30.days_with_sales) < 14 THEN 'Stock bajo: menos de 14 días'
        ELSE 'Stock adecuado'
      END as reason,
      CASE 
        WHEN s30.orders_count >= 5 AND s30.days_with_sales >= 10 THEN 'high'
        WHEN s30.orders_count >= 2 AND s30.days_with_sales >= 5 THEN 'medium'
        ELSE 'low'
      END as data_confidence
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN current_inventory ci ON pv.id = ci.variant_id
    LEFT JOIN pending_production pp ON pv.id = pp.variant_id
    LEFT JOIN sales_30d s30 ON pv.id = s30.variant_id
    WHERE p.organization_id = org_id
      AND pv.is_active = true
  )
  
  -- Insertar sugerencias
  INSERT INTO inventory_replenishment (
    variant_id,
    product_name,
    sku,
    sku_variant,
    variant_size,
    variant_color,
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
    organization_id,
    calculation_date,
    status
  )
  SELECT 
    variant_id,
    product_name,
    sku,
    sku_variant,
    variant_size,
    variant_color,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency::TEXT,
    reason,
    data_confidence::TEXT,
    org_id,
    CURRENT_DATE,
    'pending'
  FROM suggestions
  WHERE suggested_quantity > 0
  ON CONFLICT (variant_id, calculation_date, organization_id) 
  DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    pending_production = EXCLUDED.pending_production,
    sales_30d = EXCLUDED.sales_30d,
    orders_count_30d = EXCLUDED.orders_count_30d,
    avg_daily_sales = EXCLUDED.avg_daily_sales,
    days_of_supply = EXCLUDED.days_of_supply,
    projected_30d_demand = EXCLUDED.projected_30d_demand,
    suggested_quantity = EXCLUDED.suggested_quantity,
    urgency = EXCLUDED.urgency,
    reason = EXCLUDED.reason,
    data_confidence = EXCLUDED.data_confidence,
    calculated_at = NOW();
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculation_date', CURRENT_DATE
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$$;