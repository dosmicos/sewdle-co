/**
 * Mapeo de estados de envío (Envia.com / transportadoras) → etapa de notificación.
 *
 * El webhook de Envia manda un `status` + descripción/evento por cada cambio.
 * Aquí lo normalizamos a una etapa interna y, en paralelo, a un `labelStatus`
 * compatible con el que ya escribe `envia-track` (delivered/returned/exception/in_transit),
 * para no romper los badges existentes en la UI de envíos.
 *
 * Solo 3 etapas disparan WhatsApp al cliente (ver NOTIFIABLE_STAGES):
 * recolectado, en_reparto e incidencia. "entregado" y "otro" solo actualizan el status.
 */

export type ShipmentStage =
  | 'recolectado'
  | 'en_reparto'
  | 'incidencia'
  | 'entregado'
  | 'otro';

export interface StageResult {
  /** Etapa interna; decide si se notifica y con qué plantilla. */
  stage: ShipmentStage;
  /** Status normalizado para `shipping_labels.status` (compatible con envia-track). */
  labelStatus: string;
}

/** Etapas que envían WhatsApp al cliente (decisión de producto). */
export const NOTIFIABLE_STAGES: ShipmentStage[] = ['recolectado', 'en_reparto', 'incidencia'];

export function isNotifiable(stage: ShipmentStage): boolean {
  return NOTIFIABLE_STAGES.includes(stage);
}

/** lowercase + sin tildes, para que "tránsito" haga match con /transito/. */
function norm(s: string | null | undefined): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Clasifica un estado de envío en una etapa interna.
 * El orden de evaluación importa: "entregado" y "devolución" ganan primero,
 * "incidencia" debe evaluarse antes que "en_reparto" (p. ej. "en reparto - primer
 * intento fallido" es una incidencia, no un simple reparto).
 *
 * @param status      campo `status` del webhook (p. ej. "delivered", "in_transit").
 * @param description descripción o último evento (p. ej. "Primer intento fallido - cliente ausente").
 */
export function mapShipmentStage(
  status?: string | null,
  description?: string | null,
): StageResult {
  const text = norm(`${status ?? ''} ${description ?? ''}`).trim();
  if (!text) return { stage: 'otro', labelStatus: 'in_transit' };

  // Entregado (cierre) — gana sobre todo. "entregad" NO matchea "entrega" (intento de entrega).
  if (/entregad|delivered/.test(text)) {
    return { stage: 'entregado', labelStatus: 'delivered' };
  }

  // Devolución / retorno al remitente → no notifica (la incidencia ya pasó antes).
  if (/devuel|devolucion|returned|retorno/.test(text)) {
    return { stage: 'otro', labelStatus: 'returned' };
  }

  // Incidencia / intento fallido / novedad — antes que "en_reparto".
  if (/novedad|incidencia|intento|exception|excepcion|fallid|ausente|rechaz|direccion|no contactado|reprogram|no localizado|cerrado/.test(text)) {
    return { stage: 'incidencia', labelStatus: 'exception' };
  }

  // En reparto / salida a distribución.
  if (/repart|distribu|out for delivery|en ruta|en camino|gestion de entrega/.test(text)) {
    return { stage: 'en_reparto', labelStatus: 'in_transit' };
  }

  // Recolectado / admitido por la transportadora (primer escaneo del courier).
  if (/recogid|recolectad|picked|admitid/.test(text)) {
    return { stage: 'recolectado', labelStatus: 'in_transit' };
  }

  // Tránsito y cualquier otro → solo actualiza status, no notifica.
  return { stage: 'otro', labelStatus: 'in_transit' };
}
