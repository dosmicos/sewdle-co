import type { PickingOrder } from '@/hooks/usePickingOrders';
import type { CreateLabelRequest } from '../types/envia';
import { isContraEntregaPayment } from '@/lib/paymentMethod';

// Helper to get proxied label URL (evita CORS al abrir/descargar el PDF de Envia)
export const getProxyLabelUrl = (labelUrl: string): string => {
  return `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/proxy-label?url=${encodeURIComponent(labelUrl)}`;
};

// Municipios grandes de Cundinamarca donde Coordinadora es preferido
export const CUNDINAMARCA_COORDINADORA_CITIES = [
  'bogota', 'soacha', 'chia', 'zipaquira', 'facatativa', 'subachoque',
  'cajica', 'cota', 'funza', 'mosquera', 'madrid', 'tenjo', 'tabio',
  'la calera', 'tocancipa', 'gachancipa', 'sibate', 'fusagasuga',
  'girardot', 'villeta', 'choconta', 'suesca', 'guaduas'
];

// Municipios del Valle de Aburrá (Antioquia) donde Coordinadora es preferido
export const VALLE_ABURRA_CITIES = [
  'medellin', 'bello', 'itagui', 'envigado', 'sabaneta',
  'la estrella', 'caldas', 'copacabana', 'girardota', 'barbosa',
  'rionegro'
];

// All cities referenced in carrier rules — used for fuzzy correction of typos
export const ALL_CARRIER_RULE_CITIES = [
  ...CUNDINAMARCA_COORDINADORA_CITIES,
  ...VALLE_ABURRA_CITIES,
  'jamundi', 'cali', 'calima', 'darien',
  'floridablanca', 'giron',
  'tunja', 'labranzagrande',
  'manizales',
  'dosquebradas',
  'la ceja',
  'barranquilla', 'cartagena', 'bucaramanga', 'cucuta',
  'pereira', 'villavicencio', 'pasto', 'santa marta', 'monteria',
  'armenia', 'popayan', 'sincelejo', 'valledupar',
  'florencia', 'riohacha'
];

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function normalizeLocationText(text?: string | null): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function fuzzyMatchCity(input: string): string {
  if (ALL_CARRIER_RULE_CITIES.includes(input)) return input;
  let bestMatch = input;
  let bestDist = Infinity;
  for (const known of ALL_CARRIER_RULE_CITIES) {
    const dist = levenshteinDistance(input, known);
    // Max 2 edits, and the input must be at least 4 chars to avoid false positives
    if (dist < bestDist && dist <= 2 && input.length >= 4) {
      bestDist = dist;
      bestMatch = known;
    }
  }
  return bestMatch;
}

export const CITY_DEPARTMENT_FALLBACKS: Record<string, string> = {
  armenia: 'Quindío',
  barranquilla: 'Atlántico',
  bogota: 'Bogotá D.C.',
  bucaramanga: 'Santander',
  cali: 'Valle del Cauca',
  cartagena: 'Bolívar',
  cucuta: 'Norte de Santander',
  florencia: 'Caquetá',
  floridablanca: 'Santander',
  giron: 'Santander',
  manizales: 'Caldas',
  medellin: 'Antioquia',
  monteria: 'Córdoba',
  pasto: 'Nariño',
  pereira: 'Risaralda',
  popayan: 'Cauca',
  riohacha: 'La Guajira',
  'santa marta': 'Magdalena',
  sincelejo: 'Sucre',
  tunja: 'Boyacá',
  valledupar: 'Cesar',
  villavicencio: 'Meta',
};

export function inferDepartmentFromCity(city?: string | null): string | null {
  const normalizedCity = fuzzyMatchCity(normalizeLocationText(city));
  return CITY_DEPARTMENT_FALLBACKS[normalizedCity] || null;
}

export type ShippingMethodType = 'Express' | 'Recoger' | 'Standard' | null;

export function getShippingMethodType(rawData: any): ShippingMethodType {
  const title: string | null = rawData?.shipping_lines?.[0]?.title || null;
  if (!title) return null;
  const lower = title.toLowerCase();
  if (lower.includes('express')) return 'Express';
  if (
    lower.includes('recog') || lower.includes('pickup') || lower.includes('tienda') ||
    lower.includes('local') || lower.includes('dosmicos')
  ) {
    return 'Recoger';
  }
  return 'Standard';
}

export type IneligibilityReason =
  | 'cancelled'
  | 'fulfilled'
  | 'wrong_status'
  | 'pickup'
  | 'express'
  | 'no_address';

export type LabelEligibility =
  | { eligible: true }
  | { eligible: false; reason: IneligibilityReason; label: string };

// Un pedido puede entrar al lote masivo solo si está Empacado y tiene
// envío estándar con dirección completa (mismas exclusiones que el modal).
export function getLabelEligibility(order: PickingOrder): LabelEligibility {
  const shopifyOrder = order.shopify_order;
  if (shopifyOrder?.cancelled_at) {
    return { eligible: false, reason: 'cancelled', label: 'Cancelado' };
  }
  if (shopifyOrder?.fulfillment_status === 'fulfilled') {
    return { eligible: false, reason: 'fulfilled', label: 'Ya enviado' };
  }
  if (order.operational_status !== 'ready_to_ship') {
    return { eligible: false, reason: 'wrong_status', label: 'No está Empacado' };
  }
  const methodType = getShippingMethodType(shopifyOrder?.raw_data);
  if (methodType === 'Recoger') {
    return { eligible: false, reason: 'pickup', label: 'Recoger en tienda' };
  }
  if (methodType === 'Express') {
    return { eligible: false, reason: 'express', label: 'Express' };
  }
  const shippingAddress = shopifyOrder?.raw_data?.shipping_address;
  if (!shippingAddress?.city || !shippingAddress?.address1) {
    return { eligible: false, reason: 'no_address', label: 'Sin dirección' };
  }
  return { eligible: true };
}

// Mensajes operativos para errores del edge function create-envia-label
export function friendlyLabelError(errorCode?: string, fallback?: string): string {
  switch (errorCode) {
    case 'DANE_NOT_FOUND':
      return 'Ciudad no reconocida en cobertura';
    case 'DIFFICULT_ACCESS_ZONE':
      return 'Zona de difícil acceso: enviar con reclamo en oficina';
    case 'SERVICE_NOT_AVAILABLE':
      return 'Transportadora sin servicio para esta ruta — generar manual con otra transportadora';
    default:
      return fallback || 'Error generando la guía';
  }
}

// Espejo del request individual (EnviaShippingButton handleQuoteAndCreateLabel)
// sin preferred_carrier: la edge function selecciona transportadora por reglas.
export function buildCreateLabelRequest(
  order: PickingOrder,
  organizationId: string
): { ok: true; request: CreateLabelRequest } | { ok: false; error: string } {
  const shopifyOrder = order.shopify_order;
  const rawData = shopifyOrder?.raw_data;
  const shippingAddress = rawData?.shipping_address;

  if (!shopifyOrder || !shippingAddress?.city || !shippingAddress?.address1) {
    return { ok: false, error: 'Pedido sin dirección de envío completa' };
  }

  // current_total_price refleja ediciones/reembolsos post-venta de Shopify;
  // total_price queda congelado en el valor original.
  const declaredValue =
    parseFloat(rawData?.current_total_price) || Number(shopifyOrder.total_price) || 0;

  const isCOD = isContraEntregaPayment({
    paymentGatewayNames: rawData?.payment_gateway_names,
    gateway: rawData?.gateway,
    tags: shopifyOrder.tags,
    financialStatus: shopifyOrder.financial_status,
  });

  const request: CreateLabelRequest = {
    shopify_order_id: shopifyOrder.shopify_order_id,
    organization_id: organizationId,
    order_number: shopifyOrder.order_number,
    recipient_name: shippingAddress.name || 'Cliente',
    recipient_phone: shippingAddress.phone || shopifyOrder.customer_phone || '',
    recipient_email: shopifyOrder.customer_email || '',
    destination_address: shippingAddress.address1 || '',
    destination_address2: shippingAddress.address2 || '',
    destination_city: shippingAddress.city || '',
    destination_department:
      shippingAddress.province?.trim() || inferDepartmentFromCity(shippingAddress.city) || '',
    destination_postal_code: shippingAddress.zip || '',
    declared_value: declaredValue,
    package_content: `Pedido ${shopifyOrder.order_number}`,
    is_cod: isCOD,
    cod_amount: isCOD ? declaredValue : undefined,
  };

  return { ok: true, request };
}
