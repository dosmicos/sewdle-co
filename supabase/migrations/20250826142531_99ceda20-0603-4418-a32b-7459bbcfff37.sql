
-- Fix the overloaded function that takes (org_id uuid) so it matches the schema used by the app

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
    0 AS sales_last_30_days,
    0 AS sales_last_7_days,
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
