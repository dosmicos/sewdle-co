-- Update refresh_inventory_replenishment to calculate pending as: total ordered - total delivered (all statuses)
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count INT := 0;
BEGIN
  -- Borrar registros del día actual para recalcular
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = CURRENT_DATE;

  -- Insertar nuevos cálculos de reposición basados en ventas de Shopify
  WITH sales_data AS (
    SELECT 
      pv.id as variant_id,
      SUM(soli.quantity) as sales_30d,
      COUNT(DISTINCT so.shopify_order_id) as orders_count_30d
    FROM shopify_order_line_items soli
    JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    JOIN product_variants pv ON soli.sku = pv.sku_variant
    WHERE so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND soli.sku IS NOT NULL
    GROUP BY pv.id
  ),
  delivered_quantities AS (
    SELECT 
      oi.product_variant_id,
      SUM(di.quantity_approved) as total_delivered
    FROM delivery_items di
    JOIN order_items oi ON di.order_item_id = oi.id
    JOIN deliveries d ON di.delivery_id = d.id
    JOIN orders o ON d.order_id = o.id
    WHERE o.organization_id = org_id
    GROUP BY oi.product_variant_id
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
    pv.id,
    CURRENT_DATE,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0) - COALESCE(dq.total_delivered, 0),
    COALESCE(sd.sales_30d, 0),
    COALESCE(sd.orders_count_30d, 0),
    ROUND(COALESCE(sd.sales_30d, 0) / 30.0, 2),
    CASE 
      WHEN COALESCE(sd.sales_30d, 0) > 0 THEN
        ROUND((COALESCE(pv.stock_quantity, 0) * 30.0) / sd.sales_30d, 1)
      ELSE NULL
    END,
    ROUND(COALESCE(sd.sales_30d, 0) * 40.0 / 30.0, 0),
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN
        ROUND(COALESCE(sd.sales_30d, 0) * 40.0 / 30.0, 0)
      WHEN COALESCE(sd.sales_30d, 0) > 0 THEN
        GREATEST(0, ROUND(COALESCE(sd.sales_30d, 0) * 40.0 / 30.0, 0) - COALESCE(pv.stock_quantity, 0))
      ELSE 0
    END,
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 'critical'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND (COALESCE(pv.stock_quantity, 0) * 30.0 / sd.sales_30d) < 15 THEN 'high'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND (COALESCE(pv.stock_quantity, 0) * 30.0 / sd.sales_30d) < 30 THEN 'medium'
      ELSE 'low'
    END,
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND COALESCE(sd.sales_30d, 0) > 0 THEN 
        'Sin stock disponible con demanda activa'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND (COALESCE(pv.stock_quantity, 0) * 30.0 / sd.sales_30d) < 15 THEN 
        'Stock bajo: menos de 15 días de inventario'
      WHEN COALESCE(sd.sales_30d, 0) > 0 AND (COALESCE(pv.stock_quantity, 0) * 30.0 / sd.sales_30d) < 30 THEN 
        'Stock medio: menos de 30 días de inventario'
      WHEN COALESCE(sd.sales_30d, 0) = 0 THEN
        'Sin ventas en los últimos 30 días'
      ELSE 
        'Stock suficiente por ahora'
    END,
    CASE
      WHEN COALESCE(sd.orders_count_30d, 0) >= 5 THEN 'high'
      WHEN COALESCE(sd.orders_count_30d, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END,
    'pending'
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_data sd ON sd.variant_id = pv.id
  LEFT JOIN LATERAL (
    SELECT SUM(oi.quantity) as pending_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_variant_id = pv.id
      AND o.organization_id = org_id
  ) pp ON true
  LEFT JOIN delivered_quantities dq ON dq.product_variant_id = pv.id
  WHERE p.organization_id = org_id
    AND p.status = 'active';

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN json_build_object('inserted', inserted_count);
END;
$$;