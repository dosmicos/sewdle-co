-- Repair Shopify orders that are present locally but missing from Picking & Packing.
-- This also fixes stale picking order numbers, which can make search return zero rows.

INSERT INTO public.picking_packing_orders (
  shopify_order_id,
  organization_id,
  operational_status,
  order_number,
  created_at,
  updated_at
)
SELECT
  so.shopify_order_id,
  so.organization_id,
  CASE
    WHEN so.cancelled_at IS NOT NULL THEN 'pending'
    WHEN so.fulfillment_status = 'fulfilled' THEN 'shipped'
    WHEN lower(coalesce(so.tags, '')) LIKE '%empacado%' THEN 'ready_to_ship'
    ELSE 'pending'
  END,
  so.order_number,
  coalesce(so.created_at_shopify, now()),
  now()
FROM public.shopify_orders so
LEFT JOIN public.picking_packing_orders ppo
  ON ppo.organization_id = so.organization_id
 AND ppo.shopify_order_id = so.shopify_order_id
WHERE ppo.id IS NULL
  AND so.organization_id IS NOT NULL
  AND so.shopify_order_id IS NOT NULL
  AND so.order_number IS NOT NULL
ON CONFLICT (organization_id, shopify_order_id) DO NOTHING;

UPDATE public.picking_packing_orders ppo
SET
  order_number = so.order_number,
  updated_at = now()
FROM public.shopify_orders so
WHERE ppo.organization_id = so.organization_id
  AND ppo.shopify_order_id = so.shopify_order_id
  AND so.order_number IS NOT NULL
  AND ppo.order_number IS DISTINCT FROM so.order_number;
