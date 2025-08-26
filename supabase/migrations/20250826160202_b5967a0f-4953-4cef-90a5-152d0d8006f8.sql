-- Drop the existing function with org_id parameter that has stale data issues
DROP FUNCTION IF EXISTS public.get_replenishment_suggestions_with_details(uuid);

-- Recreate with dynamic calculations that compute everything in real-time
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details(org_id uuid)
RETURNS TABLE(
  variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_last_30_days integer,
  sales_last_7_days integer,
  sales_velocity numeric,
  stock_days_remaining numeric,
  open_orders_quantity integer,
  suggested_quantity integer,
  urgency_level text,
  reason text,
  status text,
  calculation_date date,
  min_stock_level integer,
  max_stock_level integer,
  lead_time_days integer,
  safety_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH base_variants AS (
    SELECT 
      pv.id AS variant_id,
      p.name AS product_name,
      pv.size AS variant_size,
      pv.color AS variant_color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) AS current_stock
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    WHERE p.organization_id = org_id
      AND (p.status IS NULL OR p.status = 'active')
  ),
  sales_data AS (
    SELECT 
      bv.variant_id,
      -- Sales last 30 days - DYNAMIC CALCULATION
      COALESCE(SUM(soli.quantity) FILTER (
        WHERE DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
      ), 0)::integer AS sales_last_30_days,
      -- Sales last 7 days - DYNAMIC CALCULATION  
      COALESCE(SUM(soli.quantity) FILTER (
        WHERE DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '7 days'
      ), 0)::integer AS sales_last_7_days
    FROM base_variants bv
    LEFT JOIN public.shopify_order_line_items soli ON soli.sku = bv.sku_variant
    LEFT JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = org_id
      AND so.financial_status IN ('paid', 'partially_paid', 'pending')
      AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY bv.variant_id
  ),
  open_orders_data AS (
    SELECT 
      bv.variant_id,
      -- Open orders quantity - DYNAMIC CALCULATION
      COALESCE(SUM(
        GREATEST(0, oi.quantity - COALESCE(approved_deliveries.total_approved, 0))
      ), 0)::integer AS open_orders_quantity
    FROM base_variants bv
    LEFT JOIN public.order_items oi ON oi.product_variant_id = bv.variant_id
    LEFT JOIN public.orders o ON oi.order_id = o.id
      AND o.organization_id = org_id
      AND o.status IN ('pending', 'assigned', 'in_progress')
    LEFT JOIN (
      SELECT 
        di.order_item_id,
        SUM(COALESCE(di.quantity_approved, 0)) AS total_approved
      FROM public.delivery_items di
      JOIN public.deliveries d ON di.delivery_id = d.id
      WHERE d.status IN ('approved', 'partial_approved')
      GROUP BY di.order_item_id
    ) approved_deliveries ON oi.id = approved_deliveries.order_item_id
    GROUP BY bv.variant_id
  ),
  config_data AS (
    SELECT 
      bv.variant_id,
      COALESCE(rc.min_stock_level, 0) AS min_stock_level,
      COALESCE(rc.max_stock_level, 100) AS max_stock_level,
      COALESCE(rc.lead_time_days, 15) AS lead_time_days,
      COALESCE(rc.safety_days, 15) AS safety_days
    FROM base_variants bv
    LEFT JOIN public.replenishment_config rc ON rc.product_variant_id = bv.variant_id
      AND rc.organization_id = org_id
      AND rc.is_active = true
  ),
  suggestions_data AS (
    SELECT 
      bv.variant_id,
      rs.suggested_quantity,
      rs.urgency_level,
      rs.reason,
      rs.status,
      rs.calculation_date
    FROM base_variants bv
    LEFT JOIN public.replenishment_suggestions rs ON rs.product_variant_id = bv.variant_id
      AND rs.organization_id = org_id
      AND rs.calculation_date = CURRENT_DATE
  )
  SELECT 
    bv.variant_id,
    bv.product_name,
    bv.variant_size,
    bv.variant_color,
    bv.sku_variant,
    bv.current_stock,
    sd.sales_last_30_days,
    sd.sales_last_7_days,
    -- DYNAMIC SALES VELOCITY CALCULATION (daily average)
    CASE 
      WHEN sd.sales_last_30_days > 0 THEN ROUND((sd.sales_last_30_days::numeric / 30.0), 4)
      ELSE 0
    END AS sales_velocity,
    -- DYNAMIC STOCK DAYS REMAINING CALCULATION
    CASE 
      WHEN sd.sales_last_30_days > 0 THEN 
        ROUND(bv.current_stock::numeric / (sd.sales_last_30_days::numeric / 30.0), 2)
      ELSE 9999
    END AS stock_days_remaining,
    ood.open_orders_quantity,
    COALESCE(sugd.suggested_quantity, 0) AS suggested_quantity,
    COALESCE(sugd.urgency_level, 'normal') AS urgency_level,
    COALESCE(sugd.reason, 'No suggestion available') AS reason,
    COALESCE(sugd.status, 'pending') AS status,
    COALESCE(sugd.calculation_date, CURRENT_DATE) AS calculation_date,
    cd.min_stock_level,
    cd.max_stock_level,
    cd.lead_time_days,
    cd.safety_days
  FROM base_variants bv
  JOIN sales_data sd ON bv.variant_id = sd.variant_id
  JOIN open_orders_data ood ON bv.variant_id = ood.variant_id
  JOIN config_data cd ON bv.variant_id = cd.variant_id
  LEFT JOIN suggestions_data sugd ON bv.variant_id = sugd.variant_id
  ORDER BY bv.product_name, bv.variant_size, bv.variant_color;
END;
$$;