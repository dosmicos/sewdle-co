-- ============================================
-- SISTEMA DE REPOSICIÓN NUEVO (DESDE CERO) - V3
-- ============================================

-- 1. Nueva tabla independiente para reposición
CREATE TABLE IF NOT EXISTS inventory_replenishment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Datos de stock e inventario
  current_stock integer NOT NULL DEFAULT 0,
  pending_production integer NOT NULL DEFAULT 0,
  
  -- Métricas de ventas (Shopify últimos 60 días)
  sales_60d integer NOT NULL DEFAULT 0,
  orders_count_60d integer NOT NULL DEFAULT 0,
  avg_daily_sales numeric(10,2) NOT NULL DEFAULT 0,
  
  -- Cálculos de reposición
  days_of_supply numeric(10,1),
  projected_30d_demand integer NOT NULL DEFAULT 0,
  suggested_quantity integer NOT NULL DEFAULT 0,
  
  -- Clasificación y análisis
  urgency text NOT NULL DEFAULT 'low' CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  reason text,
  data_confidence text NOT NULL DEFAULT 'low' CHECK (data_confidence IN ('high', 'medium', 'low')),
  
  -- Metadata
  calculated_at timestamptz NOT NULL DEFAULT now(),
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed'))
);

-- 2. Constraint para evitar duplicados por día
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_replenishment_unique_per_day 
  ON inventory_replenishment(organization_id, variant_id, calculation_date);

-- 3. Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_inventory_replenishment_org_date 
  ON inventory_replenishment(organization_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_replenishment_urgency 
  ON inventory_replenishment(urgency) WHERE urgency IN ('critical', 'high');
CREATE INDEX IF NOT EXISTS idx_inventory_replenishment_variant 
  ON inventory_replenishment(variant_id);

-- 4. RLS Policies
ALTER TABLE inventory_replenishment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view replenishment in their org"
  ON inventory_replenishment FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
  );

CREATE POLICY "Admins manage replenishment"
  ON inventory_replenishment FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
    AND get_current_user_role_safe() IN ('Administrador', 'Diseñador')
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_users 
      WHERE user_id = auth.uid() 
        AND status = 'active'
    )
  );

-- 5. Función para calcular sugerencias de reposición
CREATE OR REPLACE FUNCTION refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_count integer := 0;
  result jsonb;
BEGIN
  -- Limpiar cálculos del día actual
  DELETE FROM inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;
  
  -- Calcular nuevas sugerencias basadas en datos reales
  WITH shopify_sales AS (
    SELECT 
      pv.id as variant_id,
      COUNT(DISTINCT so.shopify_order_id) as order_count,
      COALESCE(SUM(soli.quantity), 0)::integer as total_sold
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '60 days'
      AND so.financial_status IN ('paid', 'partially_paid')
      AND so.cancelled_at IS NULL
      AND so.organization_id = org_id
    WHERE p.organization_id = org_id
      AND p.status = 'active'
    GROUP BY pv.id
  ),
  production_pending AS (
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0)::integer as pending_qty
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_progress')
    GROUP BY oi.product_variant_id
  )
  INSERT INTO inventory_replenishment (
    organization_id,
    variant_id,
    current_stock,
    pending_production,
    sales_60d,
    orders_count_60d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency,
    reason,
    data_confidence,
    calculation_date
  )
  SELECT 
    org_id,
    pv.id,
    COALESCE(pv.stock_quantity, 0),
    COALESCE(pp.pending_qty, 0),
    COALESCE(ss.total_sold, 0),
    COALESCE(ss.order_count, 0),
    ROUND(COALESCE(ss.total_sold, 0)::numeric / 60.0, 2),
    -- Days of supply
    CASE 
      WHEN COALESCE(ss.total_sold, 0) > 0 
      THEN ROUND(COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 60.0), 1)
      ELSE NULL
    END,
    -- Projected 30-day demand
    ROUND(COALESCE(ss.total_sold, 0)::numeric / 60.0 * 30, 0)::integer,
    -- Suggested quantity
    GREATEST(0, ROUND(COALESCE(ss.total_sold, 0)::numeric / 60.0 * 30, 0)::integer - COALESCE(pv.stock_quantity, 0)),
    -- Urgency level
    CASE
      WHEN COALESCE(ss.total_sold, 0) = 0 THEN 'low'
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND ss.total_sold > 0 THEN 'critical'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 60.0) < 7 THEN 'critical'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 60.0) < 15 THEN 'high'
      WHEN ss.total_sold > 0 AND COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 60.0) < 30 THEN 'medium'
      ELSE 'low'
    END,
    -- Reason
    CASE
      WHEN COALESCE(ss.total_sold, 0) = 0 THEN 'Sin ventas en últimos 60 días'
      WHEN COALESCE(pv.stock_quantity, 0) = 0 AND ss.total_sold > 0 THEN 'Stock agotado con demanda activa'
      WHEN ss.total_sold > 0 THEN 
        'Stock para ' || ROUND(COALESCE(pv.stock_quantity, 0)::numeric / (ss.total_sold::numeric / 60.0), 0)::text || ' días (' || 
        ROUND(ss.total_sold::numeric / 60.0, 1)::text || ' uds/día)'
      ELSE 'Stock suficiente'
    END,
    -- Data confidence
    CASE
      WHEN COALESCE(ss.order_count, 0) >= 5 THEN 'high'
      WHEN COALESCE(ss.order_count, 0) >= 2 THEN 'medium'
      ELSE 'low'
    END,
    CURRENT_DATE
  FROM product_variants pv
  INNER JOIN products p ON pv.product_id = p.id
  LEFT JOIN shopify_sales ss ON pv.id = ss.variant_id
  LEFT JOIN production_pending pp ON pv.id = pp.product_variant_id
  WHERE p.organization_id = org_id
    AND p.status = 'active'
    AND (COALESCE(ss.total_sold, 0) > 0 OR COALESCE(pv.stock_quantity, 0) > 0);
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  result := jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'calculated_at', now()
  );
  
  RETURN result;
END;
$$;

-- 6. Vista para simplificar consultas
CREATE OR REPLACE VIEW v_replenishment_details AS
SELECT 
  ir.id,
  ir.organization_id,
  ir.variant_id,
  p.name as product_name,
  p.sku,
  pv.sku_variant,
  pv.size as variant_size,
  pv.color as variant_color,
  ir.current_stock,
  ir.pending_production,
  ir.sales_60d,
  ir.orders_count_60d,
  ir.avg_daily_sales,
  ir.days_of_supply,
  ir.projected_30d_demand,
  ir.suggested_quantity,
  ir.urgency,
  ir.reason,
  ir.data_confidence,
  ir.calculated_at,
  ir.status
FROM inventory_replenishment ir
INNER JOIN product_variants pv ON ir.variant_id = pv.id
INNER JOIN products p ON pv.product_id = p.id
WHERE ir.calculation_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY 
  CASE ir.urgency
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  ir.suggested_quantity DESC;

COMMENT ON TABLE inventory_replenishment IS 'Sistema de reposición inteligente basado en datos reales de Shopify';
COMMENT ON FUNCTION refresh_inventory_replenishment IS 'Calcula sugerencias de reposición usando ventas de Shopify (60 días)';