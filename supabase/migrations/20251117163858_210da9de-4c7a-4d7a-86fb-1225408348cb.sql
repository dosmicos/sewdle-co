-- Drop and recreate refresh_inventory_replenishment with duplicate handling
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS TABLE(inserted integer) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Delete previous calculations for this organization
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = CURRENT_DATE;

  -- Calculate sales data with deduplication using DISTINCT ON
  WITH sales_data AS (
    SELECT 
      pv.id AS product_variant_id,
      COUNT(DISTINCT so.id) AS orders_count_30d,
      COALESCE(SUM(distinct_items.quantity), 0) AS sales_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN LATERAL (
      -- Get only ONE record per order + sku combination (most recent)
      SELECT DISTINCT ON (soi.shopify_order_id, soi.sku)
        soi.shopify_order_id,
        soi.quantity
      FROM shopify_order_line_items soi
      WHERE pv.sku_variant = soi.sku::text
      ORDER BY soi.shopify_order_id, soi.sku, soi.created_at DESC
    ) distinct_items ON true
    LEFT JOIN shopify_orders so 
      ON distinct_items.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'authorized')
      AND so.cancelled_at IS NULL
    WHERE p.organization_id = org_id
    GROUP BY pv.id
  ),
  -- Calculate current stock
  stock_data AS (
    SELECT 
      pv.id AS product_variant_id,
      COALESCE(pv.stock_quantity, 0) AS current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  -- Calculate pending production
  pending_data AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(
        oi.quantity - COALESCE(
          (SELECT COALESCE(SUM(di.quantity_approved), 0)
           FROM delivery_items di
           JOIN deliveries d ON di.delivery_id = d.id
           WHERE di.order_item_id = oi.id
             AND d.status = 'entregado'), 
          0
        )
      ), 0) AS pending_production
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pendiente', 'en_proceso', 'produccion')
    GROUP BY oi.product_variant_id
  )
  -- Insert replenishment calculations
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
    COALESCE(sd_stock.current_stock, 0),
    COALESCE(pd.pending_production, 0),
    COALESCE(sd_sales.sales_30d, 0),
    COALESCE(sd_sales.orders_count_30d, 0),
    COALESCE(sd_sales.sales_30d / 30.0, 0),
    CASE 
      WHEN COALESCE(sd_sales.sales_30d / 30.0, 0) > 0 
      THEN COALESCE(sd_stock.current_stock, 0) / (sd_sales.sales_30d / 30.0)
      ELSE 999
    END,
    COALESCE(sd_sales.sales_30d / 30.0 * 40, 0),
    GREATEST(
      0,
      CEIL(
        COALESCE(sd_sales.sales_30d / 30.0 * 40, 0) - 
        COALESCE(sd_stock.current_stock, 0) - 
        COALESCE(pd.pending_production, 0)
      )
    ),
    CASE
      WHEN COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0) <= 0 
           AND COALESCE(sd_sales.sales_30d, 0) > 0 
      THEN 'critical'
      WHEN COALESCE(sd_sales.sales_30d / 30.0, 0) > 0 
           AND (COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0)) / (sd_sales.sales_30d / 30.0) < 7 
      THEN 'high'
      WHEN COALESCE(sd_sales.sales_30d / 30.0, 0) > 0 
           AND (COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0)) / (sd_sales.sales_30d / 30.0) < 15 
      THEN 'medium'
      ELSE 'low'
    END,
    CASE
      WHEN COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0) <= 0 
           AND COALESCE(sd_sales.sales_30d, 0) > 0 
      THEN 'Sin stock y con demanda activa'
      WHEN COALESCE(sd_sales.sales_30d / 30.0, 0) > 0 
           AND (COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0)) / (sd_sales.sales_30d / 30.0) < 7 
      THEN 'Menos de 7 días de inventario'
      WHEN COALESCE(sd_sales.sales_30d / 30.0, 0) > 0 
           AND (COALESCE(sd_stock.current_stock, 0) + COALESCE(pd.pending_production, 0)) / (sd_sales.sales_30d / 30.0) < 15 
      THEN 'Menos de 15 días de inventario'
      ELSE 'Stock suficiente'
    END,
    CASE
      WHEN COALESCE(sd_sales.orders_count_30d, 0) >= 5 THEN 'high'
      WHEN COALESCE(sd_sales.orders_count_30d, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END,
    'active'
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN sales_data sd_sales ON pv.id = sd_sales.product_variant_id
  LEFT JOIN stock_data sd_stock ON pv.id = sd_stock.product_variant_id
  LEFT JOIN pending_data pd ON pv.id = pd.product_variant_id
  WHERE p.organization_id = org_id;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN QUERY SELECT inserted_count;
END;
$$;