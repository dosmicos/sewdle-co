
-- =====================================================
-- FIX CRITICO: Corregir inflación 10x en ventas + preservar executed + cobertura 21 días
-- =====================================================

-- 1. Drop y recrear función con lógica corregida
DROP FUNCTION IF EXISTS refresh_inventory_replenishment(uuid);

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
  -- CORREGIDO: Solo borrar registros pending/rejected, preservar executed/completed
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = today_date
    AND status NOT IN ('executed', 'completed');

  -- Insertar nuevos cálculos
  WITH 
  -- FIX CRITICO: Ventas de Shopify con INNER JOIN para evitar inflación 10x
  -- ANTES: LEFT JOIN sin filtro de fecha sumaba TODAS las ventas históricas
  -- AHORA: LATERAL subquery con INNER JOIN + filtros estrictos
  sales_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(s.total_qty, 0) as sales_30d,
      COALESCE(s.order_count, 0) as orders_count_30d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT 
        SUM(soli.quantity) as total_qty,
        COUNT(DISTINCT so.id) as order_count
      FROM shopify_order_line_items soli
      INNER JOIN shopify_orders so 
        ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '30 days'
        AND so.financial_status NOT IN ('refunded', 'voided')
        AND so.cancelled_at IS NULL
    ) s ON true
    WHERE p.organization_id = org_id
      AND p.status = 'active'
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
  
  -- Variantes ya ejecutadas hoy (no recalcular)
  executed_today AS (
    SELECT variant_id
    FROM inventory_replenishment
    WHERE organization_id = org_id
      AND calculation_date = today_date
      AND status IN ('executed', 'completed')
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
      -- CAMBIADO: Proyección a 21 días en vez de 40
      CASE 
        WHEN COALESCE(sales.sales_30d, 0) > 0 
        THEN ROUND((sales.sales_30d::numeric / 30) * 21, 0)
        ELSE 0 
      END as projected_demand_21d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sales ON pv.id = sales.variant_id
    LEFT JOIN pending_orders po ON pv.id = po.product_variant_id
    LEFT JOIN delivery_data dd ON pv.id = dd.product_variant_id
    LEFT JOIN stock_data sd ON pv.id = sd.variant_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
      -- No recalcular variantes ya ejecutadas hoy
      AND pv.id NOT IN (SELECT variant_id FROM executed_today)
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
    rc.projected_demand_21d,
    -- CAMBIADO: Cobertura objetivo 21 días
    GREATEST(0, rc.projected_demand_21d - rc.current_stock - rc.pending_production - rc.in_transit) as suggested_quantity,
    -- Urgencia basada en días de stock
    CASE 
      WHEN rc.days_of_supply IS NULL OR rc.days_of_supply <= 0 THEN 
        CASE WHEN rc.sales_30d > 0 THEN 'critical' ELSE 'low' END
      WHEN rc.days_of_supply <= 7 THEN 'critical'
      WHEN rc.days_of_supply <= 14 THEN 'high'
      WHEN rc.days_of_supply <= 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    -- Confianza de datos
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

-- 2. Actualizar vista para incluir pipeline_coverage_days
DROP VIEW IF EXISTS v_replenishment_details;

CREATE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.variant_id,
  ir.organization_id,
  ir.current_stock,
  ir.pending_production,
  ir.in_transit,
  ir.sales_30d,
  ir.orders_count_30d,
  ir.avg_daily_sales,
  ir.days_of_supply,
  ir.projected_demand_40d,
  ir.suggested_quantity,
  ir.urgency,
  ir.reason,
  ir.data_confidence,
  ir.calculated_at,
  ir.calculation_date,
  ir.status,
  p.name as product_name,
  p.sku,
  pv.sku_variant as sku_variant,
  pv.size as variant_size,
  pv.color as variant_color,
  -- Nueva columna: días de cobertura del pipeline actual
  CASE 
    WHEN ir.avg_daily_sales > 0 
    THEN ROUND(
      (ir.current_stock + ir.pending_production + COALESCE(ir.in_transit, 0))::numeric / ir.avg_daily_sales, 
      1
    )
    ELSE NULL
  END as pipeline_coverage_days
FROM inventory_replenishment ir
JOIN product_variants pv ON ir.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;
