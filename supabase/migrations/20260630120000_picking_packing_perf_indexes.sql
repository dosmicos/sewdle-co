-- Picking/Packing list-fetch performance indexes
--
-- Síntoma: al escanear, el flujo "se quedaba cargando" y no marcaba EMPACADO ni generaba guía
-- en algunos pedidos. Causa raíz medida en producción: la consulta de la lista
-- (picking_packing_orders ⋈ shopify_orders con count:'exact') hacía un Seq Scan de ~127 MB sobre
-- shopify_orders (org con 42k pedidos), con media ~1.1 s y máx ~6.9 s — rozando el statement_timeout
-- de 8 s del rol authenticated. Bajo la tormenta de refetch de Realtime, algunas se cancelaban por
-- timeout y la UI quedaba colgada.
--
-- Fix: dos índices de cobertura validados con EXPLAIN (ANALYZE, BUFFERS):
--   * conteo count:'exact':  401 ms (seq scan) -> 42 ms (index-only scan)
--   * datos (limit 500):     359 ms            -> 53 ms (sin sort, índice compuesto)
--
-- NOTA: en PRODUCCIÓN estos índices se crearon con CREATE INDEX CONCURRENTLY (sin bloquear
-- escrituras). Aquí usamos IF NOT EXISTS no-concurrente para que el runner de migraciones (que
-- envuelve cada archivo en una transacción) no falle; en prod ya existen, así que es un no-op, y en
-- ramas/DBs nuevas las tablas son pequeñas y el lock es despreciable.

-- 1) Elimina el Seq Scan de 127 MB sobre shopify_orders en el EXISTS/join del count:'exact'.
CREATE INDEX IF NOT EXISTS idx_shopify_orders_org_shopify_id
  ON public.shopify_orders (organization_id, shopify_order_id);

-- 2) Sirve exactamente el WHERE organization_id = ... AND order_number >= ... ORDER BY order_number DESC
--    de la consulta de datos (evita el sort y el filtro de org en memoria).
CREATE INDEX IF NOT EXISTS idx_picking_orders_org_order_number
  ON public.picking_packing_orders (organization_id, order_number DESC);
