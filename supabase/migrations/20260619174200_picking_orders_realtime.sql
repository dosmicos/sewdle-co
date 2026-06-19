-- Habilita Supabase Realtime para picking_packing_orders.
--
-- Motivo: operational_status es la fuente de verdad del empaque y se escribe al instante,
-- a diferencia del tag "EMPACADO" de Shopify, que se sincroniza de forma asíncrona (y puede
-- tardar minutos). Antes solo se escuchaba shopify_orders, por lo que un pedido ya empacado por
-- un operario seguía apareciendo en la cola "Para empacar" de otro hasta que llegaba el tag —
-- la ventana en la que el mismo pedido se empacaba dos veces.
--
-- Con la tabla en la publicación, el frontend recibe el cambio de estado de inmediato:
--  - la lista saca el pedido de la cola sin esperar a Shopify, y
--  - el modal de detalle del segundo operario detecta que ya fue empacado y bloquea el empaque.
alter publication supabase_realtime add table public.picking_packing_orders;

-- REPLICA IDENTITY FULL para que los filtros de Realtime por organization_id / id sean
-- confiables en INSERT/UPDATE/DELETE y el payload incluya el registro completo.
alter table public.picking_packing_orders replica identity full;
