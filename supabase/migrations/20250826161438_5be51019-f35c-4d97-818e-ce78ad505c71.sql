-- Drop and recreate the RPC function to fix checkbox selection issue
DROP FUNCTION IF EXISTS public.get_replenishment_suggestions_with_details();

CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id UUID,
  product_variant_id UUID,
  order_id UUID,
  product_name TEXT,
  variant_name TEXT,
  variant_size TEXT,
  variant_color TEXT,
  sku TEXT,
  sku_variant TEXT,
  suggested_quantity INTEGER,
  current_stock INTEGER,
  minimum_stock INTEGER,
  maximum_stock INTEGER,
  reorder_point INTEGER,
  sales_last_30_days INTEGER,
  sales_velocity NUMERIC,
  stock_days_remaining NUMERIC,
  open_orders_quantity INTEGER,
  urgency_level TEXT,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  current_org_id UUID;
BEGIN
  current_org_id := public.get_current_organization_safe();
  
  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  RETURN QUERY
  SELECT 
    rs.product_variant_id AS id, -- Use variant_id as unique ID for React
    rs.product_variant_id,
    NULL::UUID AS order_id,
    p.name AS product_name,
    CASE 
      WHEN pv.size IS NOT NULL AND pv.color IS NOT NULL THEN 
        pv.size || ' / ' || pv.color
      WHEN pv.size IS NOT NULL THEN pv.size
      WHEN pv.color IS NOT NULL THEN pv.color
      ELSE 'Sin variante'
    END AS variant_name,
    pv.size AS variant_size,
    pv.color AS variant_color,
    pv.sku_variant AS sku,
    pv.sku_variant AS sku_variant,
    rs.suggested_quantity,
    rs.current_stock,
    0 AS minimum_stock,
    0 AS maximum_stock,
    0 AS reorder_point,
    -- Calculate sales from Shopify data in real-time
    COALESCE((
      SELECT SUM(soli.quantity)::INTEGER
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = current_org_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    ), 0) AS sales_last_30_days,
    rs.sales_velocity,
    rs.days_of_stock AS stock_days_remaining,
    rs.open_orders_quantity,
    rs.urgency_level,
    rs.reason,
    rs.status,
    rs.created_at,
    rs.updated_at
  FROM public.replenishment_suggestions rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  WHERE rs.organization_id = current_org_id
    AND rs.calculation_date = CURRENT_DATE
  ORDER BY 
    CASE rs.urgency_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    rs.suggested_quantity DESC;
END;
$$;