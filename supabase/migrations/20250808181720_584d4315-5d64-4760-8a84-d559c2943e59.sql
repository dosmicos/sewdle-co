-- Agregar organization_id a shopify_orders y shopify_order_line_items
ALTER TABLE public.shopify_orders 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.shopify_order_line_items 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Crear índices para mejor performance
CREATE INDEX idx_shopify_orders_organization_id ON public.shopify_orders(organization_id);
CREATE INDEX idx_shopify_order_line_items_organization_id ON public.shopify_order_line_items(organization_id);

-- Migrar datos existentes a la organización "Dosmicos" (que tiene shopify_store_url configurado)
UPDATE public.shopify_orders 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE shopify_store_url IS NOT NULL 
  AND shopify_store_url != ''
  LIMIT 1
);

UPDATE public.shopify_order_line_items 
SET organization_id = (
  SELECT id FROM public.organizations 
  WHERE shopify_store_url IS NOT NULL 
  AND shopify_store_url != ''
  LIMIT 1
);

-- Hacer organization_id requerido después de la migración
ALTER TABLE public.shopify_orders 
ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.shopify_order_line_items 
ALTER COLUMN organization_id SET NOT NULL;

-- Actualizar políticas RLS para shopify_orders
DROP POLICY IF EXISTS "Authenticated users can view shopify orders" ON public.shopify_orders;
DROP POLICY IF EXISTS "System can manage shopify orders" ON public.shopify_orders;

CREATE POLICY "Users can view shopify orders in their organization" 
ON public.shopify_orders 
FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "System can manage shopify orders" 
ON public.shopify_orders 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Actualizar políticas RLS para shopify_order_line_items
DROP POLICY IF EXISTS "Authenticated users can view shopify line items" ON public.shopify_order_line_items;
DROP POLICY IF EXISTS "System can manage shopify line items" ON public.shopify_order_line_items;

CREATE POLICY "Users can view shopify line items in their organization" 
ON public.shopify_order_line_items 
FOR SELECT 
USING (organization_id = get_current_organization_safe());

CREATE POLICY "System can manage shopify line items" 
ON public.shopify_order_line_items 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Actualizar funciones RPC para incluir filtro de organización
CREATE OR REPLACE FUNCTION public.get_customer_analytics(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(customer_email text, customer_name text, orders_count bigint, total_spent numeric, avg_order_value numeric, first_order_date timestamp with time zone, last_order_date timestamp with time zone, customer_segment text)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    so.customer_email,
    CONCAT(COALESCE(so.customer_first_name, ''), ' ', COALESCE(so.customer_last_name, '')) as customer_name,
    COUNT(so.id) as orders_count,
    SUM(so.total_price) as total_spent,
    AVG(so.total_price) as avg_order_value,
    MIN(so.created_at_shopify) as first_order_date,
    MAX(so.created_at_shopify) as last_order_date,
    CASE 
      WHEN COUNT(so.id) >= 5 THEN 'VIP'
      WHEN COUNT(so.id) >= 3 THEN 'Regular' 
      WHEN COUNT(so.id) >= 2 THEN 'Repeat'
      ELSE 'New'
    END as customer_segment
  FROM public.shopify_orders so
  WHERE so.created_at_shopify >= start_date 
    AND so.created_at_shopify <= end_date + INTERVAL '1 day'
    AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    AND so.customer_email IS NOT NULL
    AND so.customer_email != ''
    AND so.organization_id = get_current_organization_safe()
  GROUP BY so.customer_email, so.customer_first_name, so.customer_last_name
  HAVING COUNT(so.id) > 0
  ORDER BY total_spent DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_sales_analytics(start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), end_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(sku text, product_title text, variant_title text, total_quantity bigint, total_revenue numeric, avg_price numeric, orders_count bigint, customers_count bigint)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    soli.sku,
    soli.title as product_title,
    COALESCE(soli.variant_title, 'Default') as variant_title,
    SUM(soli.quantity) as total_quantity,
    SUM(soli.price * soli.quantity) as total_revenue,
    AVG(soli.price) as avg_price,
    COUNT(DISTINCT so.shopify_order_id) as orders_count,
    COUNT(DISTINCT so.customer_email) as customers_count
  FROM public.shopify_order_line_items soli
  JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
  WHERE so.created_at_shopify >= start_date 
    AND so.created_at_shopify <= end_date + INTERVAL '1 day'
    AND so.financial_status IN ('paid', 'partially_paid', 'pending')
    AND soli.sku IS NOT NULL
    AND soli.sku != ''
    AND so.organization_id = get_current_organization_safe()
    AND soli.organization_id = get_current_organization_safe()
  GROUP BY soli.sku, soli.title, soli.variant_title
  HAVING SUM(soli.quantity) > 0
  ORDER BY total_revenue DESC;
$function$;