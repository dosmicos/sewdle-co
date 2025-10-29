-- Drop and recreate refresh_inventory_replenishment using product_variants.stock_quantity
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_inserted integer := 0;
  v_result jsonb;
BEGIN
  -- Delete existing suggestions for today
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment suggestions
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
    
    -- ✅ Use stock_quantity directly from product_variants
    COALESCE(pv.stock_quantity, 0) AS current_stock,
    
    -- Pending production (orders not yet delivered)
    COALESCE((
      SELECT SUM(oi.quantity)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_variant_id = pv.id
        AND o.organization_id = org_id
        AND o.status NOT IN ('delivered', 'cancelled')
    ), 0)::integer AS pending_production,
    
    -- Sales last 30 days from Shopify
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND so.cancelled_at IS NULL
    ), 0)::integer AS sales_30d,
    
    -- Number of orders in last 30 days
    COALESCE((
      SELECT COUNT(DISTINCT so.shopify_order_id)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND so.cancelled_at IS NULL
    ), 0)::integer AS orders_count_30d,
    
    -- Average daily sales
    ROUND(
      COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.cancelled_at IS NULL
      ), 0)::numeric / 30.0,
      2
    ) AS avg_daily_sales,
    
    -- Days of supply (current stock / avg daily sales)
    CASE
      WHEN COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.cancelled_at IS NULL
      ), 0) = 0 THEN NULL
      ELSE ROUND(
        (COALESCE(pv.stock_quantity, 0)::numeric / 
        (COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0)),
        1
      )
    END AS days_of_supply,
    
    -- Projected demand for next 40 days
    ROUND(
      COALESCE((
        SELECT SUM(soli.quantity)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.cancelled_at IS NULL
      ), 0)::numeric / 30.0 * 40.0
    )::integer AS projected_demand_40d,
    
    -- Suggested quantity to produce
    GREATEST(0,
      ROUND(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0 * 40.0
      )::integer - 
      COALESCE(pv.stock_quantity, 0) -
      COALESCE((
        SELECT SUM(oi.quantity)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_variant_id = pv.id
          AND o.organization_id = org_id
          AND o.status NOT IN ('delivered', 'cancelled')
      ), 0)
    )::integer AS suggested_quantity,
    
    -- Urgency level
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND 
           COALESCE((
             SELECT SUM(soli.quantity)
             FROM shopify_order_line_items soli
             JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
             WHERE soli.sku = pv.sku_variant
               AND so.organization_id = org_id
               AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
               AND so.financial_status IN ('paid', 'partially_paid')
               AND so.cancelled_at IS NULL
           ), 0) > 0
      THEN 'critical'
      WHEN COALESCE(pv.stock_quantity, 0)::numeric / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0, 0
      ) < 7
      THEN 'high'
      WHEN COALESCE(pv.stock_quantity, 0)::numeric / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0, 0
      ) < 14
      THEN 'medium'
      ELSE 'low'
    END::text AS urgency,
    
    -- Reason for suggestion
    CASE
      WHEN COALESCE(pv.stock_quantity, 0) = 0 
      THEN 'Sin inventario disponible'
      WHEN COALESCE(pv.stock_quantity, 0)::numeric / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0, 0
      ) < 7
      THEN 'Inventario crítico - menos de 1 semana'
      WHEN COALESCE(pv.stock_quantity, 0)::numeric / NULLIF(
        COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.cancelled_at IS NULL
        ), 0)::numeric / 30.0, 0
      ) < 14
      THEN 'Inventario bajo - menos de 2 semanas'
      ELSE 'Inventario adecuado'
    END AS reason,
    
    -- Data confidence
    CASE
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.cancelled_at IS NULL
      ), 0) >= 10 THEN 'high'
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.cancelled_at IS NULL
      ), 0) >= 3 THEN 'medium'
      ELSE 'low'
    END::text AS data_confidence,
    
    CURRENT_DATE AS calculation_date,
    'pending'::text AS status
    
  FROM product_variants pv
  WHERE pv.organization_id = org_id
    AND pv.active = true;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'inserted', v_inserted
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;