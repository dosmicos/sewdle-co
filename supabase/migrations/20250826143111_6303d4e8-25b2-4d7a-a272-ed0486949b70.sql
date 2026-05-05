-- Update both versions of get_replenishment_suggestions_with_details to show real sales data

-- First, update the version without parameters
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
  stock_days_remaining integer,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        rs.id,
        rs.product_variant_id,
        rs.order_id,
        p.name as product_name,
        CONCAT(COALESCE(pv.size, ''), CASE WHEN pv.size IS NOT NULL AND pv.color IS NOT NULL THEN ' - ' ELSE '' END, COALESCE(pv.color, '')) as variant_name,
        pv.sku_variant as sku,
        rs.current_stock,
        0 as minimum_stock,
        0 as maximum_stock,
        rs.suggested_quantity,
        rs.urgency_level,
        rs.reason,
        COALESCE((
          SELECT SUM(sm.sales_quantity)::integer
          FROM sales_metrics sm
          WHERE sm.product_variant_id = rs.product_variant_id
            AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
            AND sm.organization_id = rs.organization_id
        ), 0) as sales_last_30_days,
        COALESCE((
          SELECT SUM(sm.sales_quantity)::integer
          FROM sales_metrics sm
          WHERE sm.product_variant_id = rs.product_variant_id
            AND sm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
            AND sm.organization_id = rs.organization_id
        ), 0) as sales_last_7_days,
        CAST(rs.days_of_stock as integer) as stock_days_remaining,
        rs.status,
        rs.created_at,
        rs.updated_at
    FROM replenishment_suggestions rs
    JOIN product_variants pv ON rs.product_variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE rs.organization_id = get_current_organization_safe()
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

-- Now update the version with org_id parameter
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
  stock_days_remaining integer,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
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
      SELECT SUM(sm.sales_quantity)::integer
      FROM sales_metrics sm
      WHERE sm.product_variant_id = rs.product_variant_id
        AND sm.metric_date >= CURRENT_DATE - INTERVAL '30 days'
        AND sm.organization_id = org_id
    ), 0) AS sales_last_30_days,
    COALESCE((
      SELECT SUM(sm.sales_quantity)::integer
      FROM sales_metrics sm
      WHERE sm.product_variant_id = rs.product_variant_id
        AND sm.metric_date >= CURRENT_DATE - INTERVAL '7 days'
        AND sm.organization_id = org_id
    ), 0) AS sales_last_7_days,
    CAST(rs.days_of_stock AS integer) AS stock_days_remaining,
    rs.status,
    rs.created_at,
    rs.updated_at
  FROM public.replenishment_suggestions rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  WHERE rs.organization_id = org_id
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