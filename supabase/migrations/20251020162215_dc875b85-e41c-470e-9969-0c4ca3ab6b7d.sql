-- Drop and recreate function to fix ambiguous column reference
DROP FUNCTION IF EXISTS public.calculate_replenishment_suggestions();

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions()
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
  projected_demand numeric,
  suggested_quantity integer,
  urgency_level text,
  reason text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  current_org_id uuid;
  v_calculation_date DATE := CURRENT_DATE;
BEGIN
  -- Get current organization
  current_org_id := get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context found';
  END IF;

  -- Delete existing calculations for today
  DELETE FROM replenishment_suggestions 
  WHERE replenishment_suggestions.calculation_date = v_calculation_date
    AND replenishment_suggestions.organization_id = current_org_id;

  -- Insert new calculations and return them
  RETURN QUERY
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
    v_calculation_date,
    current_org_id
  FROM (
    WITH sales_analysis AS (
      SELECT 
        pv.id as variant_id,
        p.name as product_name,
        pv.size as variant_size,
        pv.color as variant_color,
        pv.sku_variant,
        COALESCE(pv.stock_quantity, 0) as current_stock,
        
        -- Sales velocity: units sold per day over last 30 days
        COALESCE(
          (SELECT COUNT(*)::numeric / 30
           FROM delivery_items di
           JOIN deliveries d ON d.id = di.delivery_id
           JOIN order_items oi ON oi.id = di.order_item_id
           WHERE oi.product_variant_id = pv.id
             AND d.delivery_date >= CURRENT_DATE - INTERVAL '30 days'
             AND d.status = 'completed'
             AND d.synced_to_shopify = true
             AND d.organization_id = current_org_id
          ), 0
        ) as sales_velocity,
        
        -- Open orders: units currently in production
        COALESCE(
          (SELECT SUM(oi.quantity - COALESCE(delivered.total_delivered, 0))
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(di.quantity_delivered), 0) as total_delivered
             FROM delivery_items di
             JOIN deliveries d ON d.id = di.delivery_id
             WHERE di.order_item_id = oi.id
               AND d.status = 'completed'
               AND d.synced_to_shopify = true
           ) delivered ON true
           WHERE oi.product_variant_id = pv.id
             AND o.status IN ('pending', 'in_progress')
             AND o.organization_id = current_org_id
          ), 0
        ) as open_orders
        
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.organization_id = current_org_id
        AND p.status = 'active'
    ),
    
    replenishment_calc AS (
      SELECT 
        variant_id,
        product_name,
        variant_size,
        variant_color,
        sku_variant,
        current_stock,
        sales_velocity,
        
        -- Days of stock remaining
        CASE 
          WHEN sales_velocity > 0 THEN 
            ROUND((current_stock::numeric / sales_velocity)::numeric, 1)
          ELSE 999
        END as days_of_stock,
        
        open_orders,
        
        -- Projected demand for next 30 days
        ROUND(sales_velocity * 30, 0) as projected_demand,
        
        -- Suggested quantity calculation
        CASE
          WHEN sales_velocity = 0 THEN 0
          WHEN (current_stock + open_orders) < (sales_velocity * 7) THEN
            -- Less than 1 week of stock: replenish to 60 days
            GREATEST(0, CEIL(sales_velocity * 60) - current_stock - open_orders)
          WHEN (current_stock + open_orders) < (sales_velocity * 14) THEN
            -- Less than 2 weeks: replenish to 45 days
            GREATEST(0, CEIL(sales_velocity * 45) - current_stock - open_orders)
          WHEN (current_stock + open_orders) < (sales_velocity * 30) THEN
            -- Less than 1 month: replenish to 30 days
            GREATEST(0, CEIL(sales_velocity * 30) - current_stock - open_orders)
          ELSE 0
        END as suggested_quantity,
        
        -- Urgency level
        CASE
          WHEN sales_velocity = 0 THEN 'none'
          WHEN (current_stock + open_orders) < (sales_velocity * 3) THEN 'critical'
          WHEN (current_stock + open_orders) < (sales_velocity * 7) THEN 'high'
          WHEN (current_stock + open_orders) < (sales_velocity * 14) THEN 'normal'
          WHEN (current_stock + open_orders) < (sales_velocity * 30) THEN 'low'
          ELSE 'none'
        END as urgency_level,
        
        -- Reason explanation
        CASE
          WHEN sales_velocity = 0 THEN 'Sin ventas en los últimos 30 días'
          WHEN (current_stock + open_orders) < (sales_velocity * 3) THEN 
            'CRÍTICO: Menos de 3 días de inventario disponible'
          WHEN (current_stock + open_orders) < (sales_velocity * 7) THEN 
            'URGENTE: Menos de 1 semana de inventario'
          WHEN (current_stock + open_orders) < (sales_velocity * 14) THEN 
            'Menos de 2 semanas de inventario'
          WHEN (current_stock + open_orders) < (sales_velocity * 30) THEN 
            'Menos de 1 mes de inventario'
          ELSE 'Inventario suficiente'
        END as reason
        
      FROM sales_analysis
    )
    
    SELECT 
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
      reason
    FROM replenishment_calc
    WHERE urgency_level != 'none'
    ORDER BY 
      CASE urgency_level
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
      END,
      sales_velocity DESC
  ) cs
  RETURNING 
    replenishment_suggestions.variant_id,
    replenishment_suggestions.product_name,
    replenishment_suggestions.variant_size,
    replenishment_suggestions.variant_color,
    replenishment_suggestions.sku_variant,
    replenishment_suggestions.current_stock,
    replenishment_suggestions.sales_velocity,
    replenishment_suggestions.days_of_stock,
    replenishment_suggestions.open_orders,
    replenishment_suggestions.projected_demand,
    replenishment_suggestions.suggested_quantity,
    replenishment_suggestions.urgency_level,
    replenishment_suggestions.reason;
END;
$$;