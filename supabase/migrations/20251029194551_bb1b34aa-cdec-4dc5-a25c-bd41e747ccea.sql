-- Configurar la vista v_replenishment_details para usar el contexto de seguridad del usuario
-- Esto permite que las políticas RLS de las tablas subyacentes se apliquen correctamente
ALTER VIEW v_replenishment_details SET (security_invoker = true);