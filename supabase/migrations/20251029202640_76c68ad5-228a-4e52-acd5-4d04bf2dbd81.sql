-- Corrección definitiva: agregar JOIN con products y usar p.organization_id
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_inserted integer := 0;
  v_result jsonb;
BEGIN
  -- Limpiar cálculos previos del día actual
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insertar nuevas sugerencias con JOIN a products para obtener organization_id
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
    calculated_at,
    status
  )
  SELECT
    org_id,
    pv.id AS variant_id,
    
    -- Stock actual desde product_variants
    COALESCE(pv.stock_quantity, 0) AS current_stock,
    
    -- Producción pendiente
    COALESCE((
      SELECT SUM(oi.quantity - COALESCE(delivered_qty, 0))
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN (
        SELECT 
          di.order_item_id,
          SUM(di.quantity_approved) as delivered_qty
        FROM delivery_items di
        JOIN deliveries d ON di.delivery_id = d.id
        WHERE d.organization_id = org_id
        GROUP BY di.order_item_id
      ) delivered ON oi.id = delivered.order_item_id
      WHERE oi.product_variant_id = pv.id
        AND o.organization_id = org_id
        AND o.status IN ('pending', 'in_progress', 'assigned')
    ), 0) AS pending_production,
    
    -- Ventas últimos 30 días desde Shopify
    COALESCE((
      SELECT SUM(sod.quantity)
      FROM shopify_order_details sod
      JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
      WHERE sod.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND so.fulfillment_status != 'cancelled'
    ), 0) AS sales_30d,
    
    -- Número de órdenes últimos 30 días
    COALESCE((
      SELECT COUNT(DISTINCT so.shopify_order_id)
      FROM shopify_order_details sod
      JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
      WHERE sod.variant_id = pv.id
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
        AND so.fulfillment_status != 'cancelled'
    ), 0) AS orders_count_30d,
    
    -- Promedio de ventas diarias
    ROUND(
      COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) / 30.0,
      2
    ) AS avg_daily_sales,
    
    -- Días de suministro
    CASE 
      WHEN COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) > 0 
      THEN ROUND(
        (COALESCE(pv.stock_quantity, 0) / 
        (COALESCE((
          SELECT SUM(sod.quantity)
          FROM shopify_order_details sod
          JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
          WHERE sod.variant_id = pv.id
            AND so.organization_id = org_id
            AND so.created_at >= NOW() - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.fulfillment_status != 'cancelled'
        ), 0) / 30.0)) * 30,
        1
      )
      ELSE NULL
    END AS days_of_supply,
    
    -- Demanda proyectada a 40 días
    ROUND(
      COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) / 30.0 * 40,
      0
    ) AS projected_demand_40d,
    
    -- Cantidad sugerida (demanda 40 días - stock actual - producción pendiente)
    GREATEST(
      ROUND(
        (COALESCE((
          SELECT SUM(sod.quantity)
          FROM shopify_order_details sod
          JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
          WHERE sod.variant_id = pv.id
            AND so.organization_id = org_id
            AND so.created_at >= NOW() - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
            AND so.fulfillment_status != 'cancelled'
        ), 0) / 30.0 * 40) - 
        COALESCE(pv.stock_quantity, 0) - 
        COALESCE((
          SELECT SUM(oi.quantity - COALESCE(delivered_qty, 0))
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          LEFT JOIN (
            SELECT 
              di.order_item_id,
              SUM(di.quantity_approved) as delivered_qty
            FROM delivery_items di
            JOIN deliveries d ON di.delivery_id = d.id
            WHERE d.organization_id = org_id
            GROUP BY di.order_item_id
          ) delivered ON oi.id = delivered.order_item_id
          WHERE oi.product_variant_id = pv.id
            AND o.organization_id = org_id
            AND o.status IN ('pending', 'in_progress', 'assigned')
        ), 0),
        0
      ),
      0
    ) AS suggested_quantity,
    
    -- Urgencia basada en días de suministro
    CASE
      WHEN COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) = 0 THEN 'low'
      WHEN (COALESCE(pv.stock_quantity, 0) / (COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) / 30.0)) * 30 < 7 THEN 'critical'
      WHEN (COALESCE(pv.stock_quantity, 0) / (COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) / 30.0)) * 30 < 14 THEN 'high'
      WHEN (COALESCE(pv.stock_quantity, 0) / (COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) / 30.0)) * 30 < 21 THEN 'medium'
      ELSE 'low'
    END AS urgency,
    
    -- Razón de la sugerencia
    CASE
      WHEN COALESCE((
        SELECT SUM(sod.quantity)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) = 0 THEN 'Sin ventas en últimos 30 días'
      WHEN COALESCE(pv.stock_quantity, 0) = 0 THEN 'Stock agotado'
      ELSE 'Stock insuficiente para demanda proyectada'
    END AS reason,
    
    -- Confianza del dato
    CASE
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) >= 5 THEN 'high'
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_details sod
        JOIN shopify_orders so ON sod.shopify_order_id = so.shopify_order_id
        WHERE sod.variant_id = pv.id
          AND so.organization_id = org_id
          AND so.created_at >= NOW() - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
          AND so.fulfillment_status != 'cancelled'
      ), 0) >= 2 THEN 'medium'
      ELSE 'low'
    END AS data_confidence,
    
    CURRENT_DATE AS calculation_date,
    NOW() AS calculated_at,
    'pending' AS status
    
  FROM product_variants pv
  JOIN products p ON pv.product_id = p.id
  WHERE p.organization_id = org_id
    AND (p.status IS NULL OR p.status = 'active')
    AND pv.sku_variant IS NOT NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'organization_id', org_id,
    'calculation_date', CURRENT_DATE
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'organization_id', org_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;