-- Fix suggested_quantity calculation in replenishment suggestions
-- Change from adding to subtracting open_orders

CREATE OR REPLACE FUNCTION calculate_replenishment_suggestions()
RETURNS TABLE (
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_velocity numeric,
  days_of_stock numeric,
  open_orders integer,
  projected_demand integer,
  suggested_quantity integer,
  urgency_level text,
  reason text
) AS $$
BEGIN
  -- Delete previous daily suggestions
  DELETE FROM replenishment_suggestions
  WHERE calculation_date = CURRENT_DATE;

  -- Calculate and insert new suggestions
  RETURN QUERY
  WITH variant_analytics AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      pv.stock_quantity as current_stock,
      COALESCE(sd.total_sold, 0) / 30.0 as sales_velocity,
      CASE 
        WHEN COALESCE(sd.total_sold, 0) = 0 THEN 999999
        ELSE pv.stock_quantity / NULLIF((COALESCE(sd.total_sold, 0) / 30.0), 0)
      END as days_of_stock,
      COALESCE(ood.open_quantity, 0)::integer as open_orders
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN (
      SELECT 
        soli.sku,
        SUM(soli.quantity) as total_sold
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
      GROUP BY soli.sku
    ) sd ON pv.sku_variant = sd.sku
    LEFT JOIN (
      SELECT 
        pv2.id as variant_id,
        COALESCE(SUM(oi.quantity), 0)::integer as open_quantity
      FROM product_variants pv2
      LEFT JOIN order_items oi ON pv2.id = oi.product_variant_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('pending', 'assigned', 'in_production')
      GROUP BY pv2.id
    ) ood ON pv.id = ood.variant_id
    WHERE pv.sku_variant IS NOT NULL
  ),
  calculated_suggestions AS (
    SELECT 
      va.variant_id,
      va.product_name,
      va.variant_size,
      va.variant_color,
      va.sku_variant,
      va.current_stock,
      va.sales_velocity,
      va.days_of_stock,
      va.open_orders,
      CASE
        WHEN va.days_of_stock < 7 THEN GREATEST(CEIL(va.sales_velocity * 30), 10)::integer
        WHEN va.days_of_stock < 14 THEN GREATEST(CEIL(va.sales_velocity * 21), 10)::integer
        WHEN va.days_of_stock < 30 THEN GREATEST(CEIL(va.sales_velocity * 14), 5)::integer
        ELSE 0
      END as projected_demand,
      CASE
        WHEN va.days_of_stock < 7 THEN 
          GREATEST(
            GREATEST(CEIL(va.sales_velocity * 30), 10) - va.current_stock - va.open_orders,
            0
          )::integer
        WHEN va.days_of_stock < 14 THEN 
          GREATEST(
            GREATEST(CEIL(va.sales_velocity * 21), 10) - va.current_stock - va.open_orders,
            0
          )::integer
        WHEN va.days_of_stock < 30 THEN 
          GREATEST(
            GREATEST(CEIL(va.sales_velocity * 14), 5) - va.current_stock - va.open_orders,
            0
          )::integer
        ELSE 0
      END as suggested_quantity,
      CASE
        WHEN va.days_of_stock < 7 THEN 'critical'
        WHEN va.days_of_stock < 14 THEN 'high'
        WHEN va.days_of_stock < 30 THEN 'normal'
        ELSE 'low'
      END as urgency_level,
      CASE
        WHEN va.days_of_stock < 7 THEN 
          'Stock crítico: Solo ' || ROUND(va.days_of_stock, 1) || ' días de inventario. Planear 30 días.'
        WHEN va.days_of_stock < 14 THEN 
          'Stock bajo: ' || ROUND(va.days_of_stock, 1) || ' días de inventario. Planear 21 días.'
        WHEN va.days_of_stock < 30 THEN 
          'Reposición normal: ' || ROUND(va.days_of_stock, 1) || ' días de inventario. Planear 14 días.'
        ELSE 
          'Stock suficiente: ' || ROUND(va.days_of_stock, 1) || ' días de inventario disponibles.'
      END as reason
    FROM variant_analytics va
  )
  INSERT INTO replenishment_suggestions (
    variant_id,
    product_name,
    variant_size,
    variant_color,
    sku_variant,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason,
    calculation_date,
    organization_id
  )
  SELECT 
    cs.*,
    CURRENT_DATE,
    (SELECT organization_id FROM product_variants WHERE id = cs.variant_id LIMIT 1)
  FROM calculated_suggestions cs
  RETURNING 
    variant_id,
    product_name,
    variant_size,
    variant_color,
    sku_variant,
    current_stock,
    sales_velocity,
    days_of_stock,
    open_orders,
    projected_demand,
    suggested_quantity,
    urgency_level,
    reason;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;