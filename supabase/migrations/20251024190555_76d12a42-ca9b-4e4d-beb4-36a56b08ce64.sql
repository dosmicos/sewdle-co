-- Inicializar TODAS las órdenes de Shopify faltantes en picking_packing_orders
INSERT INTO picking_packing_orders (shopify_order_id, organization_id, operational_status, created_at, updated_at)
SELECT 
  so.shopify_order_id,
  so.organization_id,
  'pending'::text,
  so.created_at_shopify,
  now()
FROM shopify_orders so
LEFT JOIN picking_packing_orders ppo 
  ON so.shopify_order_id = ppo.shopify_order_id 
  AND so.organization_id = ppo.organization_id
WHERE ppo.id IS NULL
ON CONFLICT (organization_id, shopify_order_id) DO NOTHING;

-- Crear índices para mejorar performance de paginación
CREATE INDEX IF NOT EXISTS idx_picking_orders_org_created 
ON picking_packing_orders(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_picking_orders_org_status_created 
ON picking_packing_orders(organization_id, operational_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_org_created 
ON shopify_orders(organization_id, created_at_shopify DESC);