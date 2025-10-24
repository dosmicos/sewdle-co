-- Sincronizar todas las órdenes de Shopify que faltan en picking_packing_orders
-- Corregido: usar shopify_order_id (bigint) en lugar de id (uuid)

INSERT INTO picking_packing_orders (
  organization_id,
  shopify_order_id,
  operational_status,
  created_at,
  updated_at
)
SELECT 
  so.organization_id,
  so.shopify_order_id,
  'pending' as operational_status,
  so.created_at_shopify as created_at,
  so.created_at_shopify as updated_at
FROM shopify_orders so
WHERE NOT EXISTS (
  SELECT 1 
  FROM picking_packing_orders ppo 
  WHERE ppo.shopify_order_id = so.shopify_order_id 
  AND ppo.organization_id = so.organization_id
)
ON CONFLICT (organization_id, shopify_order_id) 
DO NOTHING;