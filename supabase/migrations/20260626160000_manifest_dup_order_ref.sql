-- Aviso de "posible duplicado": cuando 2+ guías PENDIENTES del mismo pedido
-- (mismo nº de pedido, leído de Envia) están sin despachar, se marca su nº de
-- pedido aquí para avisar al operador SIN cancelar ninguna (no se sabe cuál es
-- la buena hasta que la transportadora despache una). La reconciliación con
-- Envia (cron 4/5 PM) llena/limpia este campo. NULL = sin aviso.
ALTER TABLE public.manifest_items
  ADD COLUMN IF NOT EXISTS dup_order_ref TEXT;
