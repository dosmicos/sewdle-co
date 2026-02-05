-- FIX: Corregir referencia a columna is_active -> status
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  today_date date := CURRENT_DATE;
BEGIN
  -- Limpiar datos de hoy para esta organización
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = today_date;

  -- Insertar nuevos cálculos
  WITH 
  -- Datos de ventas de Shopify (últimos 30 días)
  sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COUNT(DISTINCT so.id) as orders_count_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli ON soli.sku = pv.sku_variant
    LEFT JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id 
      AND so.organization_id = org_id
      AND so.created_at >= NOW() - INTERVAL '30 days'
      AND so.financial_status NOT IN ('refunded', 'voided')
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  
  -- Órdenes pendientes (excluye cancelled y completed)
  pending_orders AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0) as ordered_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status NOT IN ('cancelled', 'completed')
    GROUP BY oi.product_variant_id
  ),
  
  -- Entregas usando quantity_delivered + cálculo de in_transit
  delivery_data AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(di.quantity_delivered), 0) as total_delivered,
      COALESCE(SUM(
        CASE 
          WHEN d.status IN ('in_quality', 'partial_approved') 
          THEN di.quantity_delivered - COALESCE(di.quantity_approved, 0)
          ELSE 0 
        END
      ), 0) as in_transit_qty
    FROM deliveries d
    JOIN delivery_items di ON d.id = di.delivery_id
    JOIN order_items oi ON di.order_item_id = oi.id
    JOIN orders o ON d.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status NOT IN ('cancelled', 'completed')
    GROUP BY oi.product_variant_id
  ),
  
  -- Stock actual desde product_variants
  stock_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  
  -- Cálculo final
  replenishment_calc AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(sd.current_stock, 0) as current_stock,
      GREATEST(0, COALESCE(po.ordered_qty, 0) - COALESCE(dd.total_delivered, 0)) as pending_production,
      COALESCE(dd.in_transit_qty, 0) as in_transit,
      COALESCE(sales.sales_30d, 0) as sales_30d,
      COALESCE(sales.orders_count_30d, 0) as orders_count_30d,
      CASE 
        WHEN COALESCE(sales.sales_30d, 0) > 0 
        THEN ROUND(sales.sales_30d::numeric / 30, 2)
        ELSE 0 
      END as avg_daily_sales,
      CASE 
        WHEN COALESCE(sales.sales_30d, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
        THEN ROUND((sd.current_stock::numeric * 30) / sales.sales_30d, 1)
        ELSE NULL 
      END as days_of_supply,
      CASE 
        WHEN COALESCE(sales.sales_30d, 0) > 0 
        THEN ROUND((sales.sales_30d::numeric / 30) * 40, 0)
        ELSE 0 
      END as projected_demand_40d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sales ON pv.id = sales.variant_id
    LEFT JOIN pending_orders po ON pv.id = po.product_variant_id
    LEFT JOIN delivery_data dd ON pv.id = dd.product_variant_id
    LEFT JOIN stock_data sd ON pv.id = sd.variant_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
  )
  
  INSERT INTO inventory_replenishment (
    variant_id,
    organization_id,
    current_stock,
    pending_production,
    in_transit,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_demand_40d,
    suggested_quantity,
    urgency,
    data_confidence,
    calculation_date,
    calculated_at,
    status
  )
  SELECT 
    rc.variant_id,
    org_id,
    rc.current_stock,
    rc.pending_production,
    rc.in_transit,
    rc.sales_30d,
    rc.orders_count_30d,
    rc.avg_daily_sales,
    rc.days_of_supply,
    rc.projected_demand_40d,
    GREATEST(0, rc.projected_demand_40d - rc.current_stock - rc.pending_production - rc.in_transit) as suggested_quantity,
    CASE 
      WHEN rc.days_of_supply IS NULL OR rc.days_of_supply <= 0 THEN 
        CASE WHEN rc.sales_30d > 0 THEN 'critical' ELSE 'low' END
      WHEN rc.days_of_supply <= 7 THEN 'critical'
      WHEN rc.days_of_supply <= 14 THEN 'high'
      WHEN rc.days_of_supply <= 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    CASE 
      WHEN rc.orders_count_30d >= 10 THEN 'high'
      WHEN rc.orders_count_30d >= 3 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    today_date,
    NOW(),
    'pending'
  FROM replenishment_calc rc
  WHERE rc.sales_30d > 0 OR rc.pending_production > 0 OR rc.in_transit > 0;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN json_build_object('inserted', inserted_count);
END;
$$;