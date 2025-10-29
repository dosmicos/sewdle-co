-- Modificar función refresh_inventory_replenishment para calcular suggested_quantity con 40 días
-- Cambio: suggested_quantity ahora usa (velocidad_diaria * 40) en lugar de suma de 30 días

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
  today_date date := CURRENT_DATE;
BEGIN
  -- CTE for pending production quantities
  WITH pending_production AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as total_pending
    FROM product_variants pv
    LEFT JOIN shopify_order_line_items soli ON pv.sku_variant = soli.sku
    LEFT JOIN orders o ON soli.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress')
    GROUP BY pv.id
  )
  
  INSERT INTO inventory_replenishment (
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
    status,
    organization_id
  )
  SELECT 
    pv.id as variant_id,
    today_date as calculation_date,
    COALESCE(pv.stock_quantity, 0) as current_stock,
    COALESCE(pp.total_pending, 0) as pending_production,
    
    -- Sales in last 30 days
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
    
    -- Order count in last 30 days
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
    
    -- Average daily sales (30 days)
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
        (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
        COALESCE(
          (SELECT SUM(soli.quantity)
           FROM shopify_order_line_items soli
           JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
           WHERE soli.sku = pv.sku_variant
           AND soli.organization_id = org_id
           AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
           AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
          1
        )::numeric,
        1
      )
    END as days_of_supply,
    
    -- Projected 30d demand (unchanged, still 30 days)
    GREATEST(
      0,
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
    
    -- MODIFIED: Suggested quantity now uses (avg_daily_sales * 40) - stock - pending
    GREATEST(
      0,
      ROUND(
        (ROUND(
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
        ) * 40) - COALESCE(pv.stock_quantity, 0) - COALESCE(pp.total_pending, 0),
        0
      )
    ) as suggested_quantity,
    
    -- Urgency level (unchanged, still based on 30 days)
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
           AND COALESCE(pp.total_pending, 0) = 0
      THEN 'critical'
      
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           )::numeric, 0) < 7
      THEN 'high'
      
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           )::numeric, 0) < 15
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
           AND COALESCE(pp.total_pending, 0) = 0
      THEN 'Sin stock y con demanda activa'
      
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           )::numeric, 0) < 7
      THEN 'Stock muy bajo: menos de 7 días'
      
      WHEN (COALESCE(pv.stock_quantity, 0) + COALESCE(pp.total_pending, 0)) * 30.0 / 
           NULLIF(COALESCE(
             (SELECT SUM(soli.quantity)
              FROM shopify_order_line_items soli
              JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
              WHERE soli.sku = pv.sku_variant
              AND soli.organization_id = org_id
              AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
              AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
             0
           )::numeric, 0) < 15
      THEN 'Stock bajo: menos de 15 días'
      
      ELSE 'Reposición preventiva basada en proyección a 40 días'
    END as reason,
    
    -- Data confidence (unchanged, still based on 30 days)
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
      ) >= 5 THEN 'high'
      
      WHEN COALESCE(
        (SELECT COUNT(DISTINCT so.shopify_order_id)
         FROM shopify_order_line_items soli
         JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
         WHERE soli.sku = pv.sku_variant
         AND soli.organization_id = org_id
         AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
         AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'),
        0
      ) >= 2 THEN 'medium'
      
      ELSE 'low'
    END as data_confidence,
    
    'pending' as status,
    org_id as organization_id
    
  FROM product_variants pv
  LEFT JOIN pending_production pp ON pv.id = pp.variant_id
  WHERE pv.organization_id = org_id
    AND pv.sku_variant IS NOT NULL
    AND pv.sku_variant != ''
    AND pv.active = true
    AND EXISTS (
      SELECT 1 
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
      AND soli.organization_id = org_id
      AND so.financial_status IN ('paid', 'partially_paid', 'refunded', 'partially_refunded')
      AND soli.created_at >= CURRENT_DATE - INTERVAL '30 days'
    )
  ON CONFLICT (variant_id, calculation_date) 
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
    calculated_at = now();
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculation_date', today_date
  );
END;
$$;