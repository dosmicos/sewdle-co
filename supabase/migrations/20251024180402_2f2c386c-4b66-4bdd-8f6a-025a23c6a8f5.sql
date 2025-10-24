-- Paso 1: Eliminar duplicados manteniendo el registro más antiguo por (organization_id, shopify_order_id)
WITH ranked AS (
  SELECT 
    id,
    organization_id,
    shopify_order_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, shopify_order_id 
      ORDER BY created_at ASC
    ) as rn
  FROM picking_packing_orders
)
DELETE FROM picking_packing_orders p
USING ranked r
WHERE p.id = r.id AND r.rn > 1;

-- Paso 2: Crear índice único para prevenir duplicados futuros
CREATE UNIQUE INDEX IF NOT EXISTS picking_unique_order_per_org
  ON picking_packing_orders (organization_id, shopify_order_id);