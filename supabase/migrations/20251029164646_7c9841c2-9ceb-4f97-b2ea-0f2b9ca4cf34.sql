-- Fix inventory_data CTE to use product_variants.stock_quantity instead of material_inventory

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INT := 0;
BEGIN
  -- Limpiar datos anteriores del día actual
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = CURRENT_DATE;

  -- CTE: Inventario actual desde product_variants
  WITH inventory_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  
  -- CTE: Producción pendiente
  pending_production AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_production')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE: Ventas últimos 30 días
  sales_data AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as sales_30d,
      COUNT(DISTINCT o.id) as orders_count
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND o.status NOT IN ('cancelled', 'draft')
    GROUP BY oi.product_variant_id
  ),
  
  -- CTE: Cálculo de métricas
  replenishment_calc AS (
    SELECT
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(inv.current_stock, 0) as current_stock,
      COALESCE(pp.pending_qty, 0) as pending_production,
      COALESCE(sd.sales_30d, 0) as sales_30d,
      COALESCE(sd.orders_count, 0) as orders_count_30d,
      COALESCE(sd.sales_30d::numeric / 30, 0) as avg_daily_sales,
      CASE 
        WHEN COALESCE(sd.sales_30d::numeric / 30, 0) > 0 
        THEN COALESCE(inv.current_stock, 0)::numeric / (sd.sales_30d::numeric / 30)
        ELSE NULL
      END as days_of_supply,
      COALESCE(sd.sales_30d, 0) as projected_30d_demand,
      GREATEST(0, 
        COALESCE(sd.sales_30d, 0) - 
        COALESCE(inv.current_stock, 0) - 
        COALESCE(pp.pending_qty, 0)
      ) as suggested_quantity,
      CASE
        WHEN COALESCE(inv.current_stock, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
        WHEN COALESCE(inv.current_stock, 0) < COALESCE(sd.sales_30d::numeric / 30 * 7, 0) THEN 'high'
        WHEN COALESCE(inv.current_stock, 0) < COALESCE(sd.sales_30d::numeric / 30 * 14, 0) THEN 'medium'
        ELSE 'low'
      END as urgency,
      CASE
        WHEN COALESCE(sd.orders_count, 0) >= 10 THEN 'high'
        WHEN COALESCE(sd.orders_count, 0) >= 3 THEN 'medium'
        ELSE 'low'
      END as data_confidence,
      CASE
        WHEN COALESCE(inv.current_stock, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 
        THEN 'Sin stock - Producto con ventas recientes'
        WHEN COALESCE(inv.current_stock, 0) < COALESCE(sd.sales_30d::numeric / 30 * 7, 0)
        THEN 'Stock bajo - Menos de 7 días de inventario'
        WHEN COALESCE(inv.current_stock, 0) < COALESCE(sd.sales_30d::numeric / 30 * 14, 0)
        THEN 'Stock medio - Menos de 14 días de inventario'
        ELSE 'Stock suficiente'
      END as reason
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN inventory_data inv ON pv.id = inv.variant_id
    LEFT JOIN pending_production pp ON pv.id = pp.variant_id
    LEFT JOIN sales_data sd ON pv.id = sd.variant_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
  )
  
  -- Insertar resultados
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
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status
  )
  SELECT
    org_id,
    variant_id,
    CURRENT_DATE,
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
    'pending'
  FROM replenishment_calc
  WHERE sales_30d > 0 OR current_stock > 0;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
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