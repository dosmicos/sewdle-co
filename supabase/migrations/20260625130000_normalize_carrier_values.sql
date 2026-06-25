-- Normaliza los valores históricos inconsistentes de shipping_labels.carrier.
--
-- Contexto: el mismo carrier se guardó bajo dos strings distintos
-- (p. ej. "interRapidisimo" 3.105 filas Y "interrapidisimo" 283 filas), por lo
-- que cualquier filtro `carrier = '<codigo>'` se perdía la mayoría de las guías.
-- A partir de ahora create-envia-label guarda el carrier ya canónico
-- (minúscula, sin tildes); esta migración corrige lo existente.

-- 1) Bajar a minúsculas sin tildes (cubre 'interRapidisimo' -> 'interrapidisimo',
--    'Coordinadora' -> 'coordinadora', etc.). Solo toca filas que cambian.
UPDATE public.shipping_labels
SET carrier = lower(translate(carrier, 'ÁÉÍÓÚÑáéíóúñ', 'AEIOUNaeioun'))
WHERE carrier IS NOT NULL
  AND carrier <> lower(translate(carrier, 'ÁÉÍÓÚÑáéíóúñ', 'AEIOUNaeioun'));

-- 2) Índice para acelerar el filtrado de candidatas del manifiesto
--    (carrier + ventana reciente por created_at).
CREATE INDEX IF NOT EXISTS idx_shipping_labels_carrier_created
  ON public.shipping_labels (carrier, created_at DESC);
