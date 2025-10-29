-- Update refresh_inventory_replenishment to exclude inactive products
-- Only generate replenishment suggestions for products with status = 'active'

CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted_count integer := 0;
  v_calculation_date date := CURRENT_DATE;
BEGIN
  -- Delete existing records for today
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
  AND calculation_date = v_calculation_date;

  -- Insert new replenishment calculations using REAL Shopify sales data
  -- Using CTEs to correctly calculate pending production
  WITH pending_by_order_item AS (
    SELECT
      oi.product_variant_id,
      oi.id as order_item_id,
      oi.quantity - COALESCE(SUM(di.quantity_approved), 0) as pending_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN delivery_items di ON di.order_item_id = oi.id
    LEFT JOIN deliveries d ON di.delivery_id = d.id
      AND d.status IN ('pending', 'in_transit', 'delivered')
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_production')
    GROUP BY oi.product_variant_id, oi.id, oi.quantity
  ),
  pending_production AS (
    SELECT
      product_variant_id,
      COALESCE(SUM(pending_qty), 0)::integer as total_pending
    FROM pending_by_order_item
    GROUP BY product_variant_id
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
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    status
  )
  SELECT
    org_id,
    pv.id,
    v_calculation_date,
    
    -- Current stock from product_variants
    COALESCE(pv.stock_quantity, 0) as current_stock,
    
    -- CORRECTED: Pending production using CTE
    COALESCE(pp.total_pending, 0) as pending_production,
    
    -- CORRECTED: Real Shopify sales from last 30 days (using shopify_order_line_items)
    COALESCE(
      (SELECT SUM(soli.quantity)
       FROM shopify_order_line_items soli
       JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
       WHERE soli.sku = pv.sku_variant
       AND soli.organization_id = org_id
       AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
       AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ) as sales_30d,
    
    -- CORRECTED: Count of distinct Shopify orders (not internal production orders)
    COALESCE(
      (SELECT COUNT(DISTINCT so.shopify_order_id)
       FROM shopify_order_line_items soli
       JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
       WHERE soli.sku = pv.sku_variant
       AND soli.organization_id = org_id
       AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
       AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
      0
    ) as orders_count_30d,
    
    -- Average daily sales (from Shopify data)
    ROUND(
      COALESCE(
        (SELECT SUM(soli.quantity)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      )::numeric / 30.0,
      2
    ) as avg_daily_sales,
    
    -- Days of supply
    CASE
      WHEN COALESCE(
        (SELECT SUM(soli.quantity)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) = 0 THEN NULL
      ELSE ROUND(
        (COALESCE(pv.stock_quantity, 0)::numeric / 
         (COALESCE(
           (SELECT SUM(soli.quantity)
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
            AND soli.organization_id = org_id
            AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
            AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
           0
         )::numeric / 30.0)),
        1
      )
    END as days_of_supply,
    
    -- Projected 30-day demand (using Shopify sales velocity)
    ROUND(
      COALESCE(
        (SELECT SUM(soli.quantity)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      )::numeric,
      0
    ) as projected_30d_demand,
    
    -- CORRECTED: Suggested quantity using CTE for pending production
    GREATEST(
      0,
      ROUND(
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        )::numeric - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.total_pending, 0),
        0
      )
    ) as suggested_quantity,
    
    -- Urgency level
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
           AND COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           ) > 0 
      THEN 'critical'
      WHEN COALESCE(pv.stock_quantity, 0) <= (
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        )::numeric / 30.0 * 7
      )
      THEN 'high'
      WHEN COALESCE(pv.stock_quantity, 0) <= (
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        )::numeric / 30.0 * 14
      )
      THEN 'medium'
      ELSE 'low'
    END as urgency,
    
    -- Reason
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
           AND COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           ) > 0 
      THEN 'Sin stock y con ventas recientes en Shopify'
      WHEN COALESCE(pv.stock_quantity, 0) <= (
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        )::numeric / 30.0 * 7
      )
      THEN 'Stock para menos de 7 días según ventas de Shopify'
      WHEN COALESCE(pv.stock_quantity, 0) <= (
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          0
        )::numeric / 30.0 * 14
      )
      THEN 'Stock para menos de 14 días según ventas de Shopify'
      ELSE 'Stock suficiente según ventas de Shopify'
    END as reason,
    
    -- Data confidence (based on order count from Shopify)
    CASE
      WHEN COALESCE(
        (SELECT COUNT(DISTINCT so.shopify_order_id)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) >= 10 THEN 'high'
      WHEN COALESCE(
        (SELECT COUNT(DISTINCT so.shopify_order_id)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) >= 3 THEN 'medium'
      ELSE 'low'
    END as data_confidence,
    
    'pending' as status
    
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  LEFT JOIN pending_production pp ON pp.product_variant_id = pv.id
  WHERE p.organization_id = org_id
    AND p.status = 'active'; -- ONLY calculate for active products

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'calculation_date', v_calculation_date
  );
END;
$function$;

COMMENT ON FUNCTION public.refresh_inventory_replenishment IS 'Calcula sugerencias de reposición solo para productos activos, usando ventas de Shopify (30 días)';