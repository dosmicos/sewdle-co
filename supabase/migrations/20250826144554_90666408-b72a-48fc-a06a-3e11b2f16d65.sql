
-- Reescritura para devolver solo la última sugerencia por variante
-- e incluir sales_velocity y open_orders_quantity, usando ventas reales de Shopify

DROP FUNCTION IF EXISTS public.get_replenishment_suggestions_with_details();
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id uuid,
  product_variant_id uuid,
  order_id uuid,
  product_name text,
  variant_name text,
  sku text,
  current_stock integer,
  minimum_stock integer,
  maximum_stock integer,
  suggested_quantity integer,
  urgency_level text,
  reason text,
  sales_last_30_days integer,
  sales_last_7_days integer,
  stock_days_remaining numeric,
  sales_velocity numeric,
  open_orders_quantity integer,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT 
      rs.*,
      row_number() OVER (
        PARTITION BY rs.product_variant_id 
        ORDER BY rs.calculation_date DESC, rs.created_at DESC
      ) AS rn
    FROM public.replenishment_suggestions rs
    WHERE rs.organization_id = public.get_current_organization_safe()
  )
  SELECT
    rs.id,
    rs.product_variant_id,
    rs.order_id,
    p.name AS product_name,
    CONCAT(
      COALESCE(pv.size, ''),
      CASE WHEN pv.size IS NOT NULL AND pv.color IS NOT NULL THEN ' - ' ELSE '' END,
      COALESCE(pv.color, '')
    ) AS variant_name,
    pv.sku_variant AS sku,
    rs.current_stock,
    0 AS minimum_stock,
    0 AS maximum_stock,
    rs.suggested_quantity,
    rs.urgency_level,
    rs.reason,
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = rs.organization_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    ), 0)::integer AS sales_last_30_days,
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = rs.organization_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '7 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    ), 0)::integer AS sales_last_7_days,
    rs.days_of_stock::numeric AS stock_days_remaining,
    rs.sales_velocity::numeric AS sales_velocity,
    rs.open_orders_quantity::integer AS open_orders_quantity,
    rs.status,
    rs.created_at,
    rs.updated_at
  FROM latest rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  WHERE rs.rn = 1
  ORDER BY 
    CASE rs.urgency_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    rs.created_at DESC;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_replenishment_suggestions_with_details(org_id uuid);
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details(org_id uuid)
RETURNS TABLE(
  id uuid,
  product_variant_id uuid,
  order_id uuid,
  product_name text,
  variant_name text,
  sku text,
  current_stock integer,
  minimum_stock integer,
  maximum_stock integer,
  suggested_quantity integer,
  urgency_level text,
  reason text,
  sales_last_30_days integer,
  sales_last_7_days integer,
  stock_days_remaining numeric,
  sales_velocity numeric,
  open_orders_quantity integer,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH latest AS (
    SELECT 
      rs.*,
      row_number() OVER (
        PARTITION BY rs.product_variant_id 
        ORDER BY rs.calculation_date DESC, rs.created_at DESC
      ) AS rn
    FROM public.replenishment_suggestions rs
    WHERE rs.organization_id = org_id
  )
  SELECT
    rs.id,
    rs.product_variant_id,
    rs.order_id,
    p.name AS product_name,
    CONCAT(
      COALESCE(pv.size, ''),
      CASE WHEN pv.size IS NOT NULL AND pv.color IS NOT NULL THEN ' - ' ELSE '' END,
      COALESCE(pv.color, '')
    ) AS variant_name,
    pv.sku_variant AS sku,
    rs.current_stock,
    0 AS minimum_stock,
    0 AS maximum_stock,
    rs.suggested_quantity,
    rs.urgency_level,
    rs.reason,
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    ), 0)::integer AS sales_last_30_days,
    COALESCE((
      SELECT SUM(soli.quantity)
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = org_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '7 days'
        AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    ), 0)::integer AS sales_last_7_days,
    rs.days_of_stock::numeric AS stock_days_remaining,
    rs.sales_velocity::numeric AS sales_velocity,
    rs.open_orders_quantity::integer AS open_orders_quantity,
    rs.status,
    rs.created_at,
    rs.updated_at
  FROM latest rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  WHERE rs.rn = 1
  ORDER BY 
    CASE rs.urgency_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    rs.created_at DESC;
END;
$function$;
