-- Rebuild replenishment system to use real Shopify sales data

-- 1. Add organization_id to replenishment_suggestions if not exists
ALTER TABLE replenishment_suggestions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 2. Add organization_id to sales_metrics if not exists
ALTER TABLE sales_metrics 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_org 
  ON replenishment_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_date 
  ON replenishment_suggestions(calculation_date);
CREATE INDEX IF NOT EXISTS idx_sales_metrics_org 
  ON sales_metrics(organization_id);

-- 4. Drop old RLS policies
DROP POLICY IF EXISTS "Authenticated users can view replenishment suggestions" 
  ON replenishment_suggestions;
DROP POLICY IF EXISTS "Admins and designers can manage replenishment suggestions" 
  ON replenishment_suggestions;

-- 5. Create new RLS policies with organization_id
CREATE POLICY "Users can view suggestions in their organization" 
  ON replenishment_suggestions FOR SELECT 
  USING (organization_id = get_current_organization_safe());

CREATE POLICY "Admins can manage suggestions in their organization" 
  ON replenishment_suggestions FOR ALL 
  USING (
    organization_id = get_current_organization_safe() 
    AND get_current_user_role_safe() = ANY(ARRAY['Administrador', 'Diseñador'])
  );

-- 6. Recreate calculate_replenishment_suggestions function with Shopify data
DROP FUNCTION IF EXISTS calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions(p_organization_id uuid)
RETURNS TABLE (
  records_inserted integer,
  calculation_date date
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_records_inserted INTEGER := 0;
BEGIN
  -- 1. Delete old suggestions from current day
  DELETE FROM replenishment_suggestions
  WHERE organization_id = p_organization_id
    AND calculation_date = CURRENT_DATE;

  -- 2. Calculate and insert new suggestions based on real Shopify sales
  WITH shopify_sales_60d AS (
    -- Shopify sales in last 60 days
    SELECT 
      pv.id as variant_uuid,
      pv.sku_variant,
      COALESCE(SUM(soli.quantity), 0) as total_sold_60d,
      COUNT(DISTINCT so.shopify_order_id) as orders_count
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_order_line_items soli ON pv.sku_variant = soli.sku
    LEFT JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.created_at_shopify >= CURRENT_DATE - INTERVAL '60 days'
      AND so.financial_status IN ('paid', 'partially_paid')
      AND so.cancelled_at IS NULL
    WHERE p.organization_id = p_organization_id
      AND p.status = 'active'
    GROUP BY pv.id, pv.sku_variant
  ),
  inventory_current AS (
    -- Current stock for each variant
    SELECT 
      pv.id as variant_uuid,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock,
      sales.total_sold_60d,
      sales.orders_count
    FROM product_variants pv
    INNER JOIN products p ON pv.product_id = p.id
    LEFT JOIN shopify_sales_60d sales ON pv.id = sales.variant_uuid
    WHERE p.organization_id = p_organization_id
      AND p.status = 'active'
  ),
  open_production_orders AS (
    -- Open production orders
    SELECT 
      oi.product_variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_quantity
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.organization_id = p_organization_id
      AND o.status IN ('pending', 'assigned', 'in_progress')
    GROUP BY oi.product_variant_id
  )
  INSERT INTO replenishment_suggestions (
    product_variant_id,
    organization_id,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders_quantity,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason,
    calculation_date,
    status,
    data_quality
  )
  SELECT 
    inv.variant_uuid,
    p_organization_id,
    inv.current_stock,
    -- Daily sales velocity (sales in 60 days / 60)
    ROUND(COALESCE(inv.total_sold_60d, 0) / 60.0, 2),
    -- Days of stock available
    CASE 
      WHEN COALESCE(inv.total_sold_60d, 0) > 0 
        THEN ROUND(inv.current_stock / (inv.total_sold_60d / 60.0), 1)
      ELSE 999.9
    END,
    -- Open production orders
    COALESCE(opo.pending_quantity, 0)::integer,
    -- Projected demand for 30 days
    ROUND(COALESCE(inv.total_sold_60d, 0) / 60.0 * 30, 0)::integer,
    -- Suggested quantity (30-day demand - current stock)
    CASE
      WHEN COALESCE(inv.total_sold_60d, 0) > 0 THEN
        GREATEST(0, ROUND((inv.total_sold_60d / 60.0) * 30 - inv.current_stock, 0))::integer
      ELSE 0
    END,
    -- Urgency level
    CASE
      WHEN COALESCE(inv.total_sold_60d, 0) = 0 THEN 'low'
      WHEN inv.current_stock = 0 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 'critical'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 'high'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 30 THEN 'normal'
      ELSE 'low'
    END,
    -- Detailed reason
    CASE
      WHEN COALESCE(inv.total_sold_60d, 0) = 0 THEN 
        'Sin ventas en Shopify en últimos 60 días'
      WHEN inv.current_stock = 0 THEN 
        'Stock agotado - Reposición urgente (Velocidad: ' || 
        ROUND(inv.total_sold_60d / 60.0, 2)::text || ' uds/día en Shopify)'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 7 THEN 
        'Stock crítico - Menos de 7 días disponibles (Velocidad Shopify: ' || 
        ROUND(inv.total_sold_60d / 60.0, 2)::text || ' uds/día, ' || 
        inv.orders_count::text || ' pedidos en 60d)'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 15 THEN 
        'Stock bajo - Menos de 15 días disponibles (Velocidad Shopify: ' || 
        ROUND(inv.total_sold_60d / 60.0, 2)::text || ' uds/día, ' || 
        inv.orders_count::text || ' pedidos en 60d)'
      WHEN inv.total_sold_60d > 0 AND inv.current_stock / (inv.total_sold_60d / 60.0) < 30 THEN 
        'Reposición recomendada (Velocidad Shopify: ' || 
        ROUND(inv.total_sold_60d / 60.0, 2)::text || ' uds/día, ' || 
        inv.orders_count::text || ' pedidos en 60d)'
      ELSE 
        'Stock adecuado para demanda actual de Shopify'
    END,
    CURRENT_DATE,
    'pending',
    -- Data quality based on number of orders
    CASE 
      WHEN inv.orders_count >= 5 THEN 'high'
      WHEN inv.orders_count >= 2 THEN 'medium'
      ELSE 'low'
    END
  FROM inventory_current inv
  LEFT JOIN open_production_orders opo ON inv.variant_uuid = opo.product_variant_id
  WHERE inv.total_sold_60d > 0 OR inv.current_stock > 0;

  -- 3. Count inserted records
  GET DIAGNOSTICS v_records_inserted = ROW_COUNT;

  -- 4. Return result
  RETURN QUERY SELECT v_records_inserted, CURRENT_DATE;
END;
$$;