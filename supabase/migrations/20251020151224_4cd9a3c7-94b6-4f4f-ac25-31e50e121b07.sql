-- Recreate calculate_replenishment_suggestions to persist calculations in replenishment_suggestions table
DROP FUNCTION IF EXISTS public.calculate_replenishment_suggestions(uuid);

CREATE OR REPLACE FUNCTION public.calculate_replenishment_suggestions(org_id uuid DEFAULT NULL)
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_org_id uuid;
  calculation_record RECORD;
BEGIN
  current_org_id := COALESCE(org_id, get_current_organization_safe());
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  -- Delete old suggestions for today to avoid duplicates
  DELETE FROM replenishment_suggestions 
  WHERE organization_id = current_org_id 
    AND calculation_date = CURRENT_DATE;

  -- Calculate and insert new suggestions
  FOR calculation_record IN
    WITH sales_data AS (
      SELECT 
        soli.sku,
        SUM(soli.quantity) as total_sold
      FROM shopify_order_line_items soli
      JOIN shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE so.organization_id = current_org_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
      GROUP BY soli.sku
    ),
    open_orders_data AS (
      SELECT 
        pv.id as variant_id,
        COALESCE(SUM(oi.quantity), 0)::integer as open_quantity
      FROM product_variants pv
      LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.status IN ('pending', 'assigned', 'in_production')
        AND o.organization_id = current_org_id
      GROUP BY pv.id
    ),
    variant_analysis AS (
      SELECT 
        pv.id as variant_id,
        p.name as product_name,
        pv.size as variant_size,
        pv.color as variant_color,
        pv.sku_variant,
        COALESCE(pv.stock_quantity, 0) as current_stock,
        COALESCE(sd.total_sold, 0) / 30.0 as sales_velocity,
        CASE 
          WHEN COALESCE(sd.total_sold, 0) > 0 THEN 
            (COALESCE(pv.stock_quantity, 0) / (COALESCE(sd.total_sold, 0) / 30.0))
          ELSE 999
        END as days_of_stock,
        COALESCE(ood.open_quantity, 0) as open_orders
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN sales_data sd ON pv.sku_variant = sd.sku
      LEFT JOIN open_orders_data ood ON pv.id = ood.variant_id
      WHERE p.organization_id = current_org_id
        AND p.status = 'active'
    )
    SELECT 
      va.variant_id,
      va.product_name,
      va.variant_size,
      va.variant_color,
      va.sku_variant,
      va.current_stock,
      ROUND(va.sales_velocity, 2) as sales_velocity,
      ROUND(va.days_of_stock, 1) as days_of_stock,
      va.open_orders,
      CEIL(va.sales_velocity * 30)::integer as projected_demand,
      CASE
        WHEN va.days_of_stock < 7 THEN 
          GREATEST(CEIL(va.sales_velocity * 30), 10)::integer - va.current_stock + va.open_orders
        WHEN va.days_of_stock < 14 THEN 
          GREATEST(CEIL(va.sales_velocity * 21), 10)::integer - va.current_stock + va.open_orders
        WHEN va.days_of_stock < 30 THEN 
          GREATEST(CEIL(va.sales_velocity * 14), 5)::integer - va.current_stock + va.open_orders
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
          'Stock crítico: solo ' || ROUND(va.days_of_stock, 1)::TEXT || ' días de inventario disponible'
        WHEN va.days_of_stock < 14 THEN 
          'Stock bajo: quedan ' || ROUND(va.days_of_stock, 1)::TEXT || ' días de inventario'
        WHEN va.days_of_stock < 30 THEN 
          'Reposición normal: ' || ROUND(va.days_of_stock, 1)::TEXT || ' días de inventario'
        ELSE 'Stock suficiente'
      END as reason
    FROM variant_analysis va
    WHERE va.sales_velocity > 0
      OR va.current_stock < 10
    ORDER BY va.days_of_stock ASC, va.sales_velocity DESC
  LOOP
    -- Insert each calculation into replenishment_suggestions table
    INSERT INTO replenishment_suggestions (
      product_variant_id,
      organization_id,
      current_stock,
      sales_velocity,
      days_of_stock,
      open_orders_quantity,
      suggested_quantity,
      urgency_level,
      reason,
      calculation_date,
      status
    ) VALUES (
      calculation_record.variant_id,
      current_org_id,
      calculation_record.current_stock,
      calculation_record.sales_velocity,
      calculation_record.days_of_stock,
      calculation_record.open_orders,
      calculation_record.suggested_quantity,
      calculation_record.urgency_level,
      calculation_record.reason,
      CURRENT_DATE,
      'pending'
    );

    -- Return the record for immediate response
    variant_id := calculation_record.variant_id;
    product_name := calculation_record.product_name;
    variant_size := calculation_record.variant_size;
    variant_color := calculation_record.variant_color;
    sku_variant := calculation_record.sku_variant;
    current_stock := calculation_record.current_stock;
    sales_velocity := calculation_record.sales_velocity;
    days_of_stock := calculation_record.days_of_stock;
    open_orders := calculation_record.open_orders;
    projected_demand := calculation_record.projected_demand;
    suggested_quantity := calculation_record.suggested_quantity;
    urgency_level := calculation_record.urgency_level;
    reason := calculation_record.reason;
    
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$;