-- Fix all incorrect JOINs in refresh_inventory_replenishment function
-- The issue is: shopify_order_line_items.shopify_order_id (bigint) was being joined to shopify_orders.id (uuid)
-- Correct: both shopify_order_id fields are bigint

DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS TABLE(inserted integer) AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  -- Eliminar registros antiguos de la misma fecha
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insertar nuevos cálculos de reposición
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
    calculation_date
  )
  SELECT
    org_id,
    pv.id AS variant_id,
    
    -- Stock actual (usando SKU TEXT para comparación)
    COALESCE((
      SELECT SUM(mi.quantity)
      FROM material_inventory mi
      WHERE mi.sku = pv.sku_variant
        AND mi.organization_id = org_id
    ), 0) AS current_stock,
    
    -- Producción pendiente (usando SKU TEXT para comparación)
    COALESCE((
      SELECT SUM(oi.quantity)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.sku = pv.sku_variant
        AND o.organization_id = org_id
        AND o.status NOT IN ('delivered', 'cancelled')
    ), 0) AS pending_production,
    
    -- Ventas últimos 30 días (CORREGIDO: usando shopify_order_id = shopify_order_id)
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS sales_30d,
    
    -- Número de órdenes últimos 30 días (CORREGIDO: usando shopify_order_id = shopify_order_id)
    COALESCE((
      SELECT COUNT(DISTINCT so.shopify_order_id)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS orders_count_30d,
    
    -- Promedio diario de ventas (CORREGIDO: usando shopify_order_id = shopify_order_id)
    COALESCE((
      SELECT SUM(soli.quantity) / 30.0
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS avg_daily_sales,
    
    -- Días de inventario disponible (CORREGIDO: usando shopify_order_id = shopify_order_id)
    CASE
      WHEN COALESCE((
        SELECT SUM(soli.quantity) / 30.0
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0) > 0 THEN
        COALESCE((
          SELECT SUM(mi.quantity)
          FROM material_inventory mi
          WHERE mi.sku = pv.sku_variant
            AND mi.organization_id = org_id
        ), 0) / (
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        )
      ELSE 999
    END AS days_of_supply,
    
    -- Demanda proyectada para 40 días (CORREGIDO: usando shopify_order_id = shopify_order_id)
    COALESCE((
      SELECT CEIL((SUM(soli.quantity) / 30.0) * 40)
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid')
    ), 0) AS projected_demand_40d,
    
    -- Cantidad sugerida para producir (CORREGIDO: usando shopify_order_id = shopify_order_id)
    GREATEST(0,
      COALESCE((
        SELECT CEIL((SUM(soli.quantity) / 30.0) * 40)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0)
      - COALESCE((
        SELECT SUM(mi.quantity)
        FROM material_inventory mi
        WHERE mi.sku = pv.sku_variant
          AND mi.organization_id = org_id
      ), 0)
      - COALESCE((
        SELECT SUM(oi.quantity)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.sku = pv.sku_variant
          AND o.organization_id = org_id
          AND o.status NOT IN ('delivered', 'cancelled')
      ), 0)
    ) AS suggested_quantity,
    
    -- Nivel de urgencia basado en días de inventario (CORREGIDO: usando shopify_order_id = shopify_order_id)
    CASE
      WHEN CASE
        WHEN COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 THEN
          COALESCE((
            SELECT SUM(mi.quantity)
            FROM material_inventory mi
            WHERE mi.sku = pv.sku_variant
              AND mi.organization_id = org_id
          ), 0) / (
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
              AND so.organization_id = org_id
              AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND so.financial_status IN ('paid', 'partially_paid')
          )
        ELSE 999
      END <= 7 THEN 'critical'
      WHEN CASE
        WHEN COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 THEN
          COALESCE((
            SELECT SUM(mi.quantity)
            FROM material_inventory mi
            WHERE mi.sku = pv.sku_variant
              AND mi.organization_id = org_id
          ), 0) / (
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
              AND so.organization_id = org_id
              AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND so.financial_status IN ('paid', 'partially_paid')
          )
        ELSE 999
      END <= 14 THEN 'high'
      WHEN CASE
        WHEN COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 THEN
          COALESCE((
            SELECT SUM(mi.quantity)
            FROM material_inventory mi
            WHERE mi.sku = pv.sku_variant
              AND mi.organization_id = org_id
          ), 0) / (
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
              AND so.organization_id = org_id
              AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND so.financial_status IN ('paid', 'partially_paid')
          )
        ELSE 999
      END <= 30 THEN 'medium'
      ELSE 'low'
    END AS urgency,
    
    -- Razón de la sugerencia
    CASE
      WHEN COALESCE((
        SELECT SUM(mi.quantity)
        FROM material_inventory mi
        WHERE mi.sku = pv.sku_variant
          AND mi.organization_id = org_id
      ), 0) = 0 THEN 'Sin stock disponible'
      WHEN CASE
        WHEN COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 THEN
          COALESCE((
            SELECT SUM(mi.quantity)
            FROM material_inventory mi
            WHERE mi.sku = pv.sku_variant
              AND mi.organization_id = org_id
          ), 0) / (
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
              AND so.organization_id = org_id
              AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND so.financial_status IN ('paid', 'partially_paid')
          )
        ELSE 999
      END <= 7 THEN 'Stock crítico: menos de 7 días de inventario'
      WHEN CASE
        WHEN COALESCE((
          SELECT SUM(soli.quantity) / 30.0
          FROM shopify_order_line_items soli
          JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
          WHERE soli.sku = pv.sku_variant
            AND so.organization_id = org_id
            AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND so.financial_status IN ('paid', 'partially_paid')
        ), 0) > 0 THEN
          COALESCE((
            SELECT SUM(mi.quantity)
            FROM material_inventory mi
            WHERE mi.sku = pv.sku_variant
              AND mi.organization_id = org_id
          ), 0) / (
            SELECT SUM(soli.quantity) / 30.0
            FROM shopify_order_line_items soli
            JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
            WHERE soli.sku = pv.sku_variant
              AND so.organization_id = org_id
              AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND so.financial_status IN ('paid', 'partially_paid')
          )
        ELSE 999
      END <= 30 THEN 'Reposición recomendada basada en demanda proyectada'
      ELSE 'Stock suficiente por ahora'
    END AS reason,
    
    -- Confianza en los datos
    CASE
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0) >= 5 THEN 'high'
      WHEN COALESCE((
        SELECT COUNT(DISTINCT so.shopify_order_id)
        FROM shopify_order_line_items soli
        JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
        WHERE soli.sku = pv.sku_variant
          AND so.organization_id = org_id
          AND so.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND so.financial_status IN ('paid', 'partially_paid')
      ), 0) >= 2 THEN 'medium'
      ELSE 'low'
    END AS data_confidence,
    
    CURRENT_DATE AS calculation_date
  FROM product_variants pv
  WHERE pv.organization_id = org_id
    AND pv.sku_variant IS NOT NULL;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN QUERY SELECT v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;