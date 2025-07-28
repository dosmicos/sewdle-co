-- Crear tabla para órdenes completas de Shopify
CREATE TABLE public.shopify_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id bigint NOT NULL UNIQUE,
  order_number text NOT NULL,
  email text,
  created_at_shopify timestamp with time zone NOT NULL,
  updated_at_shopify timestamp with time zone NOT NULL,
  cancelled_at timestamp with time zone,
  closed_at timestamp with time zone,
  processed_at timestamp with time zone,
  
  -- Estados
  financial_status text,
  fulfillment_status text,
  order_status_url text,
  
  -- Información del cliente
  customer_id bigint,
  customer_email text,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  customer_accepts_marketing boolean DEFAULT false,
  customer_orders_count integer DEFAULT 0,
  customer_total_spent numeric DEFAULT 0,
  
  -- Direcciones
  billing_address jsonb,
  shipping_address jsonb,
  
  -- Información financiera
  currency text DEFAULT 'USD',
  total_price numeric NOT NULL DEFAULT 0,
  subtotal_price numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  total_discounts numeric DEFAULT 0,
  total_shipping numeric DEFAULT 0,
  total_line_items_price numeric DEFAULT 0,
  
  -- Información adicional
  tags text,
  note text,
  source_name text,
  referring_site text,
  landing_site text,
  browser_ip text,
  order_source_url text,
  
  -- Metadatos de sincronización
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_version integer DEFAULT 1,
  raw_data jsonb,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Crear tabla para line items de órdenes Shopify
CREATE TABLE public.shopify_order_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id bigint NOT NULL,
  shopify_line_item_id bigint NOT NULL,
  
  -- Información del producto
  product_id bigint,
  variant_id bigint,
  title text NOT NULL,
  variant_title text,
  vendor text,
  product_type text,
  sku text,
  
  -- Cantidades y precios
  quantity integer NOT NULL,
  price numeric NOT NULL,
  total_discount numeric DEFAULT 0,
  
  -- Propiedades
  properties jsonb,
  gift_card boolean DEFAULT false,
  taxable boolean DEFAULT true,
  
  -- Información de fulfillment
  fulfillment_status text,
  fulfillment_service text,
  requires_shipping boolean DEFAULT true,
  
  -- Metadatos
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Clave foránea
  FOREIGN KEY (shopify_order_id) REFERENCES public.shopify_orders(shopify_order_id)
);

-- Índices para optimizar consultas
CREATE INDEX idx_shopify_orders_order_id ON public.shopify_orders(shopify_order_id);
CREATE INDEX idx_shopify_orders_email ON public.shopify_orders(customer_email);
CREATE INDEX idx_shopify_orders_created_at ON public.shopify_orders(created_at_shopify);
CREATE INDEX idx_shopify_orders_financial_status ON public.shopify_orders(financial_status);
CREATE INDEX idx_shopify_orders_customer_id ON public.shopify_orders(customer_id);
CREATE INDEX idx_shopify_orders_sync_date ON public.shopify_orders(synced_at);

CREATE INDEX idx_shopify_line_items_order_id ON public.shopify_order_line_items(shopify_order_id);
CREATE INDEX idx_shopify_line_items_sku ON public.shopify_order_line_items(sku);
CREATE INDEX idx_shopify_line_items_product_id ON public.shopify_order_line_items(product_id);
CREATE INDEX idx_shopify_line_items_variant_id ON public.shopify_order_line_items(variant_id);

-- RLS policies para shopify_orders
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shopify orders" 
ON public.shopify_orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage shopify orders" 
ON public.shopify_orders 
FOR ALL 
USING (true);

-- RLS policies para shopify_order_line_items
ALTER TABLE public.shopify_order_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shopify line items" 
ON public.shopify_order_line_items 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage shopify line items" 
ON public.shopify_order_line_items 
FOR ALL 
USING (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_shopify_orders_updated_at
BEFORE UPDATE ON public.shopify_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopify_line_items_updated_at
BEFORE UPDATE ON public.shopify_order_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para obtener análisis de clientes
CREATE OR REPLACE FUNCTION public.get_customer_analytics(
  start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  customer_email text,
  customer_name text,
  orders_count bigint,
  total_spent numeric,
  avg_order_value numeric,
  first_order_date timestamp with time zone,
  last_order_date timestamp with time zone,
  customer_segment text
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    so.customer_email,
    CONCAT(so.customer_first_name, ' ', so.customer_last_name) as customer_name,
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
    AND so.created_at_shopify <= end_date
    AND so.financial_status IN ('paid', 'partially_paid')
    AND so.customer_email IS NOT NULL
  GROUP BY so.customer_email, so.customer_first_name, so.customer_last_name
  ORDER BY total_spent DESC;
$function$;

-- Función para análisis de productos
CREATE OR REPLACE FUNCTION public.get_product_sales_analytics(
  start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  sku text,
  product_title text,
  variant_title text,
  total_quantity bigint,
  total_revenue numeric,
  avg_price numeric,
  orders_count bigint,
  customers_count bigint
)
LANGUAGE sql
STABLE
AS $function$
  SELECT 
    soli.sku,
    soli.title as product_title,
    soli.variant_title,
    SUM(soli.quantity) as total_quantity,
    SUM(soli.price * soli.quantity) as total_revenue,
    AVG(soli.price) as avg_price,
    COUNT(DISTINCT so.shopify_order_id) as orders_count,
    COUNT(DISTINCT so.customer_email) as customers_count
  FROM public.shopify_order_line_items soli
  JOIN public.shopify_orders so ON soli.shopify_order_id = so.shopify_order_id
  WHERE so.created_at_shopify >= start_date 
    AND so.created_at_shopify <= end_date
    AND so.financial_status IN ('paid', 'partially_paid')
    AND soli.sku IS NOT NULL
  GROUP BY soli.sku, soli.title, soli.variant_title
  ORDER BY total_revenue DESC;
$function$;