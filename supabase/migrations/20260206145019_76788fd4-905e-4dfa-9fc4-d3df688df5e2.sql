
-- 1. Agregar columna last_known_velocity
ALTER TABLE inventory_replenishment 
ADD COLUMN IF NOT EXISTS last_known_velocity numeric DEFAULT NULL;

-- 2. Reescribir función con CTEs de 90d, stock_days y last_velocity
CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count integer := 0;
  today_date date := CURRENT_DATE;
BEGIN
  -- Solo borrar registros pending/rejected, preservar executed/completed
  DELETE FROM inventory_replenishment 
  WHERE organization_id = org_id 
    AND calculation_date = today_date
    AND status NOT IN ('executed', 'completed');

  -- Insertar nuevos cálculos
  WITH 
  -- Ventas 30 días (existente)
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

  -- NUEVO: Ventas 90 días
  sales_90d AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(s.total_qty, 0) as sales_90d
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT SUM(soli.quantity) as total_qty
      FROM shopify_order_line_items soli
      INNER JOIN shopify_orders so 
        ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND so.created_at >= NOW() - INTERVAL '90 days'
        AND so.financial_status NOT IN ('refunded', 'voided')
        AND so.cancelled_at IS NULL
    ) s ON true
    WHERE p.organization_id = org_id
      AND p.status = 'active'
  ),

  -- NUEVO: Días con stock disponible en cada ventana
  stock_days AS (
    SELECT 
      psh.product_variant_id as variant_id,
      COUNT(DISTINCT CASE 
        WHEN psh.recorded_at >= NOW() - INTERVAL '30 days' AND psh.stock_quantity > 0
        THEN DATE(psh.recorded_at) 
      END) as days_with_stock_30d,
      COUNT(DISTINCT CASE 
        WHEN psh.stock_quantity > 0 
        THEN DATE(psh.recorded_at) 
      END) as days_with_stock_90d
    FROM product_stock_history psh
    JOIN product_variants pv ON psh.product_variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
      AND psh.recorded_at >= NOW() - INTERVAL '90 days'
    GROUP BY psh.product_variant_id
  ),

  -- NUEVO: Última velocidad conocida guardada
  last_velocity AS (
    SELECT DISTINCT ON (variant_id) 
      variant_id, 
      last_known_velocity as saved_velocity
    FROM inventory_replenishment
    WHERE organization_id = org_id 
      AND last_known_velocity > 0
    ORDER BY variant_id, calculated_at DESC
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
  
  -- Entregas con cálculo de in_transit
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
  
  -- Stock actual
  stock_data AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  
  -- Variantes ya ejecutadas hoy
  executed_today AS (
    SELECT variant_id
    FROM inventory_replenishment
    WHERE organization_id = org_id
      AND calculation_date = today_date
      AND status IN ('executed', 'completed')
  ),
  
  -- Cálculo final con velocidad ajustada
  replenishment_calc AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(sd.current_stock, 0) as current_stock,
      GREATEST(0, COALESCE(po.ordered_qty, 0) - COALESCE(dd.total_delivered, 0)) as pending_production,
      COALESCE(dd.in_transit_qty, 0) as in_transit,
      COALESCE(sales.sales_30d, 0) as sales_30d,
      COALESCE(sales.orders_count_30d, 0) as orders_count_30d,
      -- Velocidad ajustada con prioridades
      CASE
        -- P1: Velocidad ajustada 30d (dividida por días con stock)
        WHEN COALESCE(stk.days_with_stock_30d, 0) >= 5 AND COALESCE(sales.sales_30d, 0) > 0
        THEN ROUND(sales.sales_30d::numeric / stk.days_with_stock_30d, 2)
        -- P2: Velocidad ajustada 90d
        WHEN COALESCE(stk.days_with_stock_90d, 0) >= 5 AND COALESCE(s90.sales_90d, 0) > 0
        THEN ROUND(s90.sales_90d::numeric / stk.days_with_stock_90d, 2)
        -- P3: División simple 30d (si no hay historial de stock pero sí ventas)
        WHEN COALESCE(sales.sales_30d, 0) > 0
        THEN ROUND(sales.sales_30d::numeric / 30, 2)
        -- P4: FALLBACK - Última velocidad guardada
        WHEN COALESCE(lv.saved_velocity, 0) > 0
        THEN lv.saved_velocity
        ELSE 0
      END as avg_daily_sales,
      -- Días de suministro
      CASE 
        WHEN COALESCE(sales.sales_30d, 0) > 0 AND COALESCE(sd.current_stock, 0) > 0
        THEN ROUND((sd.current_stock::numeric * 30) / sales.sales_30d, 1)
        ELSE NULL 
      END as days_of_supply,
      -- Proyección a 21 días
      CASE
        WHEN COALESCE(stk.days_with_stock_30d, 0) >= 5 AND COALESCE(sales.sales_30d, 0) > 0
        THEN ROUND((sales.sales_30d::numeric / stk.days_with_stock_30d) * 21, 0)
        WHEN COALESCE(stk.days_with_stock_90d, 0) >= 5 AND COALESCE(s90.sales_90d, 0) > 0
        THEN ROUND((s90.sales_90d::numeric / stk.days_with_stock_90d) * 21, 0)
        WHEN COALESCE(sales.sales_30d, 0) > 0
        THEN ROUND((sales.sales_30d::numeric / 30) * 21, 0)
        WHEN COALESCE(lv.saved_velocity, 0) > 0
        THEN ROUND(lv.saved_velocity * 21, 0)
        ELSE 0
      END as projected_demand_21d,
      -- Razón de la velocidad
      CASE
        WHEN COALESCE(stk.days_with_stock_30d, 0) >= 5 AND COALESCE(sales.sales_30d, 0) > 0 
        THEN 'Vel. 30d ajustada (' || stk.days_with_stock_30d || 'd con stock)'
        WHEN COALESCE(stk.days_with_stock_90d, 0) >= 5 AND COALESCE(s90.sales_90d, 0) > 0 
        THEN 'Vel. 90d ajustada (' || stk.days_with_stock_90d || 'd con stock)'
        WHEN COALESCE(sales.sales_30d, 0) > 0 
        THEN 'Vel. 30d'
        WHEN COALESCE(lv.saved_velocity, 0) > 0 
        THEN 'Vel. historica guardada'
        ELSE NULL
      END as reason,
      -- Confianza de datos
      CASE
        WHEN COALESCE(stk.days_with_stock_30d, 0) >= 15 THEN 'high'
        WHEN COALESCE(stk.days_with_stock_30d, 0) >= 5 THEN 'medium'
        WHEN COALESCE(stk.days_with_stock_90d, 0) >= 5 THEN 'low'
        WHEN COALESCE(lv.saved_velocity, 0) > 0 THEN 'low'
        ELSE 'low'
      END as data_confidence
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN sales_data sales ON pv.id = sales.variant_id
    LEFT JOIN sales_90d s90 ON pv.id = s90.variant_id
    LEFT JOIN stock_days stk ON pv.id = stk.variant_id
    LEFT JOIN last_velocity lv ON pv.id = lv.variant_id
    LEFT JOIN pending_orders po ON pv.id = po.product_variant_id
    LEFT JOIN delivery_data dd ON pv.id = dd.product_variant_id
    LEFT JOIN stock_data sd ON pv.id = sd.variant_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
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
    reason,
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
    GREATEST(0, rc.projected_demand_21d - rc.current_stock - rc.pending_production - rc.in_transit) as suggested_quantity,
    -- Urgencia basada en días de stock
    CASE 
      WHEN rc.days_of_supply IS NULL OR rc.days_of_supply <= 0 THEN 
        CASE WHEN rc.avg_daily_sales > 0 THEN 'critical' ELSE 'low' END
      WHEN rc.days_of_supply <= 7 THEN 'critical'
      WHEN rc.days_of_supply <= 14 THEN 'high'
      WHEN rc.days_of_supply <= 30 THEN 'medium'
      ELSE 'low'
    END as urgency,
    rc.reason,
    rc.data_confidence,
    today_date,
    NOW(),
    'pending'
  FROM replenishment_calc rc
  WHERE rc.sales_30d > 0 
    OR rc.pending_production > 0 
    OR rc.in_transit > 0
    OR rc.avg_daily_sales > 0;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  -- Guardar velocidad para uso futuro (solo datos reales, no fallback)
  UPDATE inventory_replenishment ir
  SET last_known_velocity = ir.avg_daily_sales
  WHERE ir.organization_id = org_id
    AND ir.calculation_date = today_date
    AND ir.avg_daily_sales > 0
    AND ir.reason IS NOT NULL
    AND ir.reason NOT LIKE '%historica%';

  RETURN json_build_object('inserted', inserted_count);
END;
$function$;

-- 3. Recrear vista v_replenishment_details con reason incluido
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
  ir.last_known_velocity,
  p.name AS product_name,
  p.sku,
  pv.sku_variant,
  pv.size AS variant_size,
  pv.color AS variant_color,
  CASE
    WHEN ir.avg_daily_sales > 0 
    THEN round((ir.current_stock + ir.pending_production + COALESCE(ir.in_transit, 0))::numeric / ir.avg_daily_sales, 1)
    ELSE NULL
  END AS pipeline_coverage_days
FROM inventory_replenishment ir
JOIN product_variants pv ON ir.variant_id = pv.id
JOIN products p ON pv.product_id = p.id;
