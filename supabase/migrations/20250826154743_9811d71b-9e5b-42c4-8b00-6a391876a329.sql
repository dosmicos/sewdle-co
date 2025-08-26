-- Crear función RPC para obtener sugerencias de reposición con cálculos dinámicos
CREATE OR REPLACE FUNCTION public.get_replenishment_suggestions_with_details()
RETURNS TABLE(
  id uuid,
  product_variant_id uuid,
  product_name text,
  variant_size text,
  variant_color text,
  sku_variant text,
  current_stock integer,
  sales_last_30_days integer,
  sales_velocity numeric,
  stock_days_remaining numeric,
  open_orders_quantity integer,
  suggested_quantity integer,
  urgency_level text,
  reason text,
  status text,
  calculation_date date,
  approved_by uuid,
  approved_at timestamp with time zone,
  executed_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_org_id UUID;
BEGIN
  current_org_id := public.get_current_organization_safe();

  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo obtener la organización actual';
  END IF;

  RETURN QUERY
  WITH variant_sales AS (
    SELECT 
      pv.id as variant_id,
      p.name as product_name,
      pv.size as variant_size,
      pv.color as variant_color,
      pv.sku_variant,
      COALESCE(pv.stock_quantity, 0) as current_stock,
      
      -- Calcular ventas últimos 30 días dinámicamente
      COALESCE(SUM(soli.quantity), 0)::integer as sales_last_30_days,
      
      -- Calcular velocidad de ventas dinámicamente
      CASE 
        WHEN COALESCE(SUM(soli.quantity), 0) > 0 
        THEN ROUND((COALESCE(SUM(soli.quantity), 0)::NUMERIC / 30.0), 4)
        ELSE 0
      END as calculated_sales_velocity,
      
      -- Calcular días de stock restantes dinámicamente
      CASE 
        WHEN COALESCE(SUM(soli.quantity), 0) > 0 
        THEN ROUND(COALESCE(pv.stock_quantity, 0)::NUMERIC / NULLIF((COALESCE(SUM(soli.quantity), 0)::NUMERIC / 30.0), 0), 2)
        ELSE 9999
      END as calculated_stock_days_remaining
      
    FROM public.product_variants pv
    JOIN public.products p ON pv.product_id = p.id
    LEFT JOIN public.shopify_order_line_items soli ON soli.sku = pv.sku_variant
    LEFT JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
      AND so.organization_id = current_org_id
      AND DATE(so.created_at_shopify) >= CURRENT_DATE - INTERVAL '30 days'
      AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    WHERE p.organization_id = current_org_id
      AND (p.status IS NULL OR p.status = 'active')
    GROUP BY pv.id, p.name, pv.size, pv.color, pv.sku_variant, pv.stock_quantity
  ),
  open_orders AS (
    SELECT 
      pv.id as variant_id,
      COALESCE(SUM(
        GREATEST(0, oi.quantity - COALESCE(approved_deliveries.total_approved, 0))
      ), 0)::integer as open_orders_qty
    FROM public.product_variants pv
    LEFT JOIN public.order_items oi ON oi.product_variant_id = pv.id
    LEFT JOIN public.orders o ON oi.order_id = o.id AND o.organization_id = current_org_id
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
    GROUP BY pv.id
  )
  SELECT 
    COALESCE(rs.id, gen_random_uuid()) as id,
    vs.variant_id as product_variant_id,
    vs.product_name,
    vs.variant_size,
    vs.variant_color,
    vs.sku_variant,
    vs.current_stock,
    vs.sales_last_30_days,
    vs.calculated_sales_velocity as sales_velocity,
    vs.calculated_stock_days_remaining as stock_days_remaining,
    COALESCE(oo.open_orders_qty, 0) as open_orders_quantity,
    COALESCE(rs.suggested_quantity, 0) as suggested_quantity,
    COALESCE(rs.urgency_level, 'low') as urgency_level,
    COALESCE(rs.reason, 'Sin cálculo de reposición') as reason,
    COALESCE(rs.status, 'pending') as status,
    COALESCE(rs.calculation_date, CURRENT_DATE) as calculation_date,
    rs.approved_by,
    rs.approved_at,
    rs.executed_at,
    COALESCE(rs.created_at, now()) as created_at,
    COALESCE(rs.updated_at, now()) as updated_at
  FROM variant_sales vs
  LEFT JOIN open_orders oo ON vs.variant_id = oo.variant_id
  LEFT JOIN public.replenishment_suggestions rs ON rs.product_variant_id = vs.variant_id 
    AND rs.organization_id = current_org_id
    AND rs.calculation_date = CURRENT_DATE
  WHERE vs.sales_last_30_days >= 0  -- Incluir todas las variantes, incluso las sin ventas
  ORDER BY vs.calculated_stock_days_remaining ASC, vs.sales_last_30_days DESC;
END;
$function$;