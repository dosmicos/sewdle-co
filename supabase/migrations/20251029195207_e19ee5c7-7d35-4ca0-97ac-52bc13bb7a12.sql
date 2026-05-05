-- Remover security_invoker de v_replenishment_details
-- Esto permite que la vista ejecute con permisos del owner (postgres/superusuario)
-- y pueda acceder a todas las tablas necesarias
ALTER VIEW v_replenishment_details RESET (security_invoker);