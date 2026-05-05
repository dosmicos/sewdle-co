-- Replace sales_metrics with shopify_order_line_items in refresh_inventory_replenishment
CREATE OR REPLACE FUNCTION public.refresh_inventory_replenishment(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count integer := 0;
  v_result jsonb;
BEGIN
  -- Delete existing records for today for this organization
  DELETE FROM public.inventory_replenishment
  WHERE organization_id = org_id
    AND calculation_date = CURRENT_DATE;

  -- Insert new replenishment suggestions
  WITH current_inventory AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
  ),
  pending_production AS (
    SELECT 
      oi.product_variant_id as variant_id,
      COALESCE(SUM(oi.quantity), 0) as pending_qty
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.organization_id = org_id
      AND o.status IN ('pending', 'in_progress', 'assigned')
    GROUP BY oi.product_variant_id
  ),
  sales_30d AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(soli.quantity), 0) as sales_30d,
      COUNT(DISTINCT DATE(so.created_at_shopify)) as active_days,
      COUNT(DISTINCT so.shopify_order_id) as orders_count
    FROM public.shopify_order_line_items soli
    JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
    JOIN public.product_variants pv ON soli.variant_id::text = pv.shopify_variant_id
    JOIN public.products p ON pv.product_id = p.id
    WHERE so.created_at_shopify >= (CURRENT_DATE - INTERVAL '30 days')
      AND so.financial_status IN ('paid', 'partially_paid')
      AND p.organization_id = org_id
    GROUP BY pv.id
  ),
  replenishment_calc AS (
    SELECT
      ci.variant_id,
      ci.product_name,
      ci.variant_size,
      ci.variant_color,
      ci.sku_variant,
      ci.current_stock,
      COALESCE(pp.pending_qty, 0) as pending_production,
      COALESCE(s.sales_30d, 0) as sales_30d,
      COALESCE(s.orders_count, 0) as orders_count_30d,
      CASE 
        WHEN COALESCE(s.active_days, 0) > 0 
        THEN COALESCE(s.sales_30d, 0)::numeric / GREATEST(s.active_days, 1)
        ELSE 0 
      END as avg_daily_sales,
      CASE 
        WHEN COALESCE(s.sales_30d, 0) > 0 
        THEN (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / (COALESCE(s.sales_30d, 0)::numeric / 30)
        ELSE NULL 
      END as days_of_supply,
      ROUND(COALESCE(s.sales_30d, 0) * 1.2) as projected_30d_demand,
      GREATEST(
        0,
        ROUND(COALESCE(s.sales_30d, 0) * 1.5) - (ci.current_stock + COALESCE(pp.pending_qty, 0))
      ) as suggested_quantity,
      CASE
        WHEN ci.current_stock <= 0 AND COALESCE(s.sales_30d, 0) > 0 THEN 'critical'
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / NULLIF(COALESCE(s.sales_30d, 0)::numeric / 30, 0) < 7 THEN 'high'
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / NULLIF(COALESCE(s.sales_30d, 0)::numeric / 30, 0) < 14 THEN 'medium'
        ELSE 'low'
      END as urgency,
      CASE
        WHEN ci.current_stock <= 0 AND COALESCE(s.sales_30d, 0) > 0 
        THEN 'Sin stock y con ventas recientes'
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / NULLIF(COALESCE(s.sales_30d, 0)::numeric / 30, 0) < 7 
        THEN 'Menos de 7 días de inventario'
        WHEN (ci.current_stock + COALESCE(pp.pending_qty, 0))::numeric / NULLIF(COALESCE(s.sales_30d, 0)::numeric / 30, 0) < 14 
        THEN 'Menos de 14 días de inventario'
        ELSE 'Stock adecuado'
      END as reason,
      CASE
        WHEN COALESCE(s.orders_count, 0) >= 5 THEN 'high'
        WHEN COALESCE(s.orders_count, 0) >= 2 THEN 'medium'
        ELSE 'low'
      END as data_confidence
    FROM current_inventory ci
    LEFT JOIN pending_production pp ON ci.variant_id = pp.variant_id
    LEFT JOIN sales_30d s ON ci.variant_id = s.variant_id
    WHERE COALESCE(s.sales_30d, 0) > 0
  )
  INSERT INTO public.inventory_replenishment (
    organization_id,
    variant_id,
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
    calculation_date,
    calculated_at
  )
  SELECT
    org_id,
    variant_id,
    current_stock,
    pending_production,
    sales_30d,
    orders_count_30d,
    avg_daily_sales,
    days_of_supply,
    projected_30d_demand,
    suggested_quantity,
    urgency::text,
    reason,
    data_confidence::text,
    'pending'::text,
    CURRENT_DATE,
    now()
  FROM replenishment_calc
  ORDER BY urgency DESC, avg_daily_sales DESC;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  v_result := jsonb_build_object(
    'success', true,
    'inserted', v_inserted_count,
    'organization_id', org_id,
    'calculation_date', CURRENT_DATE
  );

  RETURN v_result;
END;
$$;