-- Habilitar REPLICA IDENTITY FULL para que Supabase Realtime envíe datos completos
ALTER TABLE shopify_orders REPLICA IDENTITY FULL;

-- Agregar la tabla a la publicación de realtime si no está
ALTER PUBLICATION supabase_realtime ADD TABLE shopify_orders;