
-- Recalcular "Ventas 30d" usando datos directos de Shopify en la función usada por la UI
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  suggested_quantity integer,
  current_stock integer,
  sales_velocity numeric,
  sales_30_days integer,
  days_of_stock numeric,
  open_orders_quantity integer,
  projected_demand integer,
  urgency_level text,
  reason text,
  status text,
  calculation_date date,
  created_at timestamp with time zone,
  pending_production_quantity integer
)
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT 
    rs.id,
    p.name AS product_name,
    pv.size AS variant_size,
    pv.color AS variant_color,
    pv.sku_variant,
    rs.suggested_quantity,
    rs.current_stock,
    rs.sales_velocity,
    COALESCE((
      SELECT SUM(soli.quantity)::integer
      FROM public.shopify_order_line_items soli
      JOIN public.shopify_orders so 
        ON soli.shopify_order_id = so.shopify_order_id
      WHERE soli.sku = pv.sku_variant
        AND so.organization_id = p.organization_id
        AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
        AND so.financial_status IN ('paid','partially_paid','pending')
    ), 0) AS sales_30_days,
    rs.days_of_stock,
    rs.open_orders_quantity,
    rs.projected_demand,
    rs.urgency_level,
    rs.reason,
    rs.status,
    rs.calculation_date,
    rs.created_at,
    COALESCE((
      SELECT SUM(oi.quantity - COALESCE(approved_deliveries.total_approved, 0))
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      LEFT JOIN (
        SELECT 
          di.order_item_id,
          SUM(COALESCE(di.quantity_approved, 0)) AS total_approved
        FROM public.delivery_items di
        JOIN public.deliveries d ON di.delivery_id = d.id
        WHERE d.status IN ('approved', 'partial_approved')
        GROUP BY di.order_item_id
      ) approved_deliveries ON oi.id = approved_deliveries.order_item_id
      WHERE oi.product_variant_id = rs.product_variant_id
        AND o.organization_id = p.organization_id
        AND o.status IN ('pending', 'assigned', 'in_progress')
        AND (oi.quantity - COALESCE(approved_deliveries.total_approved, 0)) > 0
    ), 0) AS pending_production_quantity
  FROM public.replenishment_suggestions rs
  JOIN public.product_variants pv ON rs.product_variant_id = pv.id
  JOIN public.products p ON pv.product_id = p.id
  ORDER BY 
    CASE rs.urgency_level 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'normal' THEN 3 
      WHEN 'low' THEN 4 
    END,
    rs.suggested_quantity DESC,
    p.name, pv.size, pv.color;
$function$;
