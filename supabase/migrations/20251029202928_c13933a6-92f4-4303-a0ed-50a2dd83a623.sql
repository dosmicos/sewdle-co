-- Recreate refresh_inventory_replenishment with correct Shopify table names
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count integer := 0;
  v_calculation_date date := CURRENT_DATE;
BEGIN
  -- Delete existing records for today
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = v_calculation_date;

  -- Insert new replenishment suggestions
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
    v_calculation_date,
    
    -- Current stock from Shopify
    COALESCE(pv.inventory_quantity, 0) AS current_stock,
    
    -- Pending production (items in orders not yet delivered)
    COALESCE((
      SELECT SUM(oi.quantity)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_variant_id = pv.id
        AND o.organization_id = org_id
        AND o.status NOT IN ('completed', 'cancelled')
    ), 0) AS pending_production,
    
    -- Sales last 30 days from Shopify orders
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND (so.fulfillment_status IS NULL OR so.fulfillment_status != 'cancelled')
    ), 0) AS sales_30d,
    
    -- Number of orders with this variant in last 30 days
    COALESCE((
      SELECT COUNT(DISTINCT so.shopify_order_id)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS orders_count_30d,
    
    -- Average daily sales
    COALESCE((
      SELECT SUM(soli.quantity) / 30.0
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS avg_daily_sales,
    
    -- Days of supply (current stock / avg daily sales)
    CASE 
      WHEN COALESCE((
        SELECT SUM(soli.quantity) / 30.0
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0) > 0 
      THEN COALESCE(pv.inventory_quantity, 0) / (
        SELECT SUM(soli.quantity) / 30.0
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      )
      ELSE NULL
    END AS days_of_supply,
    
    -- Projected demand for next 40 days
    COALESCE((
      SELECT ROUND((SUM(soli.quantity) / 30.0) * 40)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS projected_demand_40d,
    
    -- Suggested quantity to produce
    GREATEST(0, COALESCE((
      SELECT ROUND((SUM(soli.quantity) / 30.0) * 40) - COALESCE(pv.inventory_quantity, 0) - COALESCE((
        SELECT SUM(oi.quantity)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_variant_id = pv.id
          AND o.organization_id = org_id
          AND o.status NOT IN ('completed', 'cancelled')
      ), 0)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0)) AS suggested_quantity,
    
    -- Urgency level
    CASE
      WHEN COALESCE(pv.inventory_quantity, 0) = 0 
        AND COALESCE((
          SELECT SUM(soli.quantity)
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.variant_id = pv.id
            AND so.organization_id = org_id
            AND so.created_at >= NOW() - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 
      THEN 'critical'
      WHEN COALESCE(pv.inventory_quantity, 0) < COALESCE((
        SELECT SUM(soli.quantity) / 30.0 * 7
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0)
      THEN 'high'
      WHEN COALESCE(pv.inventory_quantity, 0) < COALESCE((
        SELECT SUM(soli.quantity) / 30.0 * 14
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0)
      THEN 'medium'
      ELSE 'low'
    END AS urgency,
    
    -- Reason for suggestion
    CASE
      WHEN COALESCE(pv.inventory_quantity, 0) = 0 THEN 'Sin inventario disponible'
      WHEN COALESCE(pv.inventory_quantity, 0) < COALESCE((
        SELECT SUM(soli.quantity) / 30.0 * 7
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0)
      THEN 'Inventario para menos de 1 semana'
      WHEN COALESCE(pv.inventory_quantity, 0) < COALESCE((
        SELECT SUM(soli.quantity) / 30.0 * 14
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0)
      THEN 'Inventario para menos de 2 semanas'
      ELSE 'Reposición preventiva'
    END AS reason,
    
    -- Data confidence
    CASE
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
      ), 0) >= 5 THEN 'high'
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
      ), 0) >= 2 THEN 'medium'
      ELSE 'low'
    END AS data_confidence,
    
    'pending' AS status
    
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.organization_id = org_id
    AND pv.sku_variant IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
    );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'calculation_date', v_calculation_date
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;