-- Force drop and recreate refresh_inventory_replenishment function
-- to ensure all type mismatches are fixed

DROP FUNCTION IF EXISTS public.refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  -- Delete existing records for today for this organization
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment calculations
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
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
    calculation_date,
    status
  )
  SELECT
    org_id,
    pv.id AS variant_id,
    
    -- Current stock from product_variants.stock_quantity
    COALESCE(pv.stock_quantity, 0) AS current_stock,
    
    -- Pending production (orders not yet delivered)
    COALESCE((
      SELECT SUM(oi.quantity - COALESCE(di_summary.delivered, 0))
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN (
        SELECT 
          di.order_item_id,
          SUM(di.quantity_delivered) AS delivered
        FROM delivery_items di
        JOIN deliveries d ON di.delivery_id = d.id
        WHERE d.organization_id = org_id
          AND d.status IN ('pending', 'in_transit', 'delivered')
        GROUP BY di.order_item_id
      ) di_summary ON di_summary.order_item_id = oi.id
      WHERE o.organization_id = org_id
        AND o.status IN ('pending', 'in_progress', 'ready')
        AND oi.product_variant_id = pv.id
    ), 0) AS pending_production,
    
    -- Sales in last 30 days from Shopify orders
    -- Using SKU matching instead of variant_id to avoid type mismatch
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.id
      JOIN orders o ON so.order_number = o.order_number
      WHERE o.organization_id = org_id
        AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
        AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) AS sales_30d,
    
    -- Count of orders with this variant in last 30 days
    COALESCE((
      SELECT COUNT(DISTINCT so.id)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.id
      JOIN orders o ON so.order_number = o.order_number
      WHERE o.organization_id = org_id
        AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
        AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    ), 0) AS orders_count_30d,
    
    -- Average daily sales
    ROUND(
      COALESCE((
        SELECT SUM(soli.quantity) / 30.0
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0)
    , 2) AS avg_daily_sales,
    
    -- Days of supply (current_stock / avg_daily_sales)
    CASE 
      WHEN COALESCE((
        SELECT SUM(soli.quantity) / 30.0
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) > 0 
      THEN ROUND(
        COALESCE(pv.stock_quantity, 0) / (
          COALESCE((
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.id
            JOIN orders o ON so.order_number = o.order_number
            WHERE o.organization_id = org_id
              AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
              AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
          ), 0)
        )
      , 2)
      ELSE NULL
    END AS days_of_supply,
    
    -- Projected demand for next 40 days
    ROUND(
      COALESCE((
        SELECT SUM(soli.quantity) / 30.0 * 40
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0)
    )::INTEGER AS projected_demand_40d,
    
    -- Suggested quantity to order
    GREATEST(0, 
      ROUND(
        COALESCE((
          SELECT SUM(soli.quantity) / 30.0 * 40
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.id
          JOIN orders o ON so.order_number = o.order_number
          WHERE o.organization_id = org_id
            AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
      )::INTEGER
      - COALESCE(pv.stock_quantity, 0)
      - COALESCE((
        SELECT SUM(oi.quantity - COALESCE(di_summary.delivered, 0))
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN (
          SELECT 
            di.order_item_id,
            SUM(di.quantity_delivered) AS delivered
          FROM delivery_items di
          JOIN deliveries d ON di.delivery_id = d.id
          WHERE d.organization_id = org_id
            AND d.status IN ('pending', 'in_transit', 'delivered')
          GROUP BY di.order_item_id
        ) di_summary ON di_summary.order_item_id = oi.id
        WHERE o.organization_id = org_id
          AND o.status IN ('pending', 'in_progress', 'ready')
          AND oi.product_variant_id = pv.id
      ), 0)
    ) AS suggested_quantity,
    
    -- Urgency level
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
      AND COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) > 0
      THEN 'critical'
      
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.id
          JOIN orders o ON so.order_number = o.order_number
          WHERE o.organization_id = org_id
            AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
      , 0) < 7
      THEN 'high'
      
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.id
          JOIN orders o ON so.order_number = o.order_number
          WHERE o.organization_id = org_id
            AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
      , 0) < 20
      THEN 'medium'
      
      ELSE 'low'
    END AS urgency,
    
    -- Reason text
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
      AND COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) > 0
      THEN 'Sin stock y con ventas recientes'
      
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.id
          JOIN orders o ON so.order_number = o.order_number
          WHERE o.organization_id = org_id
            AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
      , 0) < 7
      THEN 'Stock bajo - menos de 1 semana de inventario'
      
      WHEN COALESCE(pv.stock_quantity, 0) / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.id
          JOIN orders o ON so.order_number = o.order_number
          WHERE o.organization_id = org_id
            AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
            AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
      , 0) < 20
      THEN 'Stock moderado - menos de 3 semanas de inventario'
      
      ELSE 'Stock adecuado'
    END AS reason,
    
    -- Data confidence
    CASE
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) >= 5
      THEN 'high'
      
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.id
        JOIN orders o ON so.order_number = o.order_number
        WHERE o.organization_id = org_id
          AND soli.sku = pv.sku_variant  -- TEXT = TEXT comparison
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      ), 0) >= 2
      THEN 'medium'
      
      ELSE 'low'
    END AS data_confidence,
    
    CURRENT_DATE AS calculation_date,
    'pending' AS status
    
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.organization_id = org_id
    AND pv.is_active = true;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'date', CURRENT_DATE
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_detail', SQLSTATE
    );
END;
$function$;