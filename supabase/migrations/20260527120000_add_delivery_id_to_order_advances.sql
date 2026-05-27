-- Vincula los anticipos creados desde el botón "Pago Anticipado" de una entrega
-- con la entrega específica, para poder identificar visualmente cuáles entregas
-- ya tienen un anticipo registrado.
--
-- ON DELETE SET NULL: si se borra la entrega, el anticipo queda huérfano pero
-- sigue afectando el balance del taller (no se borra dinero por accidente).

ALTER TABLE public.order_advances
  ADD COLUMN IF NOT EXISTS delivery_id uuid
    REFERENCES public.deliveries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_advances_delivery_id
  ON public.order_advances(delivery_id)
  WHERE delivery_id IS NOT NULL;

-- Backfill: los anticipos creados antes de esta migración guardan el tracking
-- number en la nota con el prefijo "Anticipo para entrega <tracking>". Vinculamos
-- por tracking_number cuando la coincidencia sea única.
UPDATE public.order_advances oa
SET delivery_id = d.id
FROM public.deliveries d
WHERE oa.delivery_id IS NULL
  AND oa.notes IS NOT NULL
  AND d.tracking_number IS NOT NULL
  AND oa.notes ILIKE 'Anticipo para entrega ' || d.tracking_number || '%'
  AND oa.order_id = d.order_id;

COMMENT ON COLUMN public.order_advances.delivery_id IS
  'Entrega específica que originó el anticipo (cuando aplica). NULL para anticipos creados a nivel de orden, no de entrega.';
