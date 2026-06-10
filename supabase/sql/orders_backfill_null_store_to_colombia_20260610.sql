-- Ejecutado el 2026-06-10 directamente en producción (registro, no re-ejecutar).
-- Contexto: tras el lanzamiento multi-tienda (2026-05-21), las órdenes creadas
-- con el selector en "Todas las tiendas" quedaban con store_id NULL y resultaban
-- invisibles para usuarios con una tienda activa seleccionada.
-- Afectó 13 órdenes: ORD-0177, ORD-0180 a ORD-0191 (excepto ORD-0178/0179 de USA).

UPDATE public.orders
SET store_id = '9d6fbb17-ed2d-4dba-ad5a-7dcd9a055953' -- Colombia
WHERE store_id IS NULL
  AND organization_id = 'cb497af2-3f29-4bb4-be53-91b7f19e5ffb';
