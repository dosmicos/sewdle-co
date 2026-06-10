import { useCallback, useSyncExternalStore } from 'react';
import type { PickingOrder } from '@/hooks/usePickingOrders';
import type { CreateLabelResponse, ShippingLabel } from '../types/envia';
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction';
import { buildCreateLabelRequest, friendlyLabelError } from '../lib/orderLabelUtils';

export type AutoLabelStatus = 'idle' | 'generating' | 'ready' | 'error';

export interface AutoLabelState {
  status: AutoLabelStatus;
  label?: ShippingLabel;
  carrier?: string;
  trackingNumber?: string;
  errorCode?: string;
  errorMessage?: string;
  /** 'existing' = el edge function respondió "Label already exists" (no auto-imprimir) */
  source?: 'created' | 'existing';
  readyAt?: number;
  startedAt?: number;
  autoPrintConsumed: boolean;
}

const IDLE_STATE: AutoLabelState = { status: 'idle', autoPrintConsumed: false };
const LABEL_TIMEOUT_MS = 45_000;
const ENTRY_TTL_MS = 60 * 60 * 1000;

// Store a nivel de módulo: sobrevive a la navegación entre pedidos y al
// cierre del modal. El fetch no se cancela al desmontar componentes y el
// edge function persiste la guía server-side de todas formas.
const states = new Map<number, AutoLabelState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

function setState(shopifyOrderId: number, patch: Partial<AutoLabelState>) {
  const prev = states.get(shopifyOrderId) ?? IDLE_STATE;
  states.set(shopifyOrderId, { ...prev, ...patch });
  emit();
}

function pruneOldEntries() {
  const now = Date.now();
  for (const [id, state] of states) {
    const age = now - (state.readyAt ?? state.startedAt ?? now);
    if (age > ENTRY_TTL_MS) states.delete(id);
  }
}

/**
 * Dispara la generación de guía en segundo plano (fire-and-forget).
 * Idempotente en UI (ignora si ya está generating/ready) y en servidor
 * (create-envia-label responde "Label already exists" si hay guía activa).
 */
export function startAutoLabelGeneration(order: PickingOrder, organizationId: string): void {
  const shopifyOrderId = order.shopify_order?.shopify_order_id;
  if (!shopifyOrderId) return;

  const current = states.get(shopifyOrderId);
  if (current && (current.status === 'generating' || current.status === 'ready')) return;

  pruneOldEntries();

  const built = buildCreateLabelRequest(order, organizationId);
  if (!built.ok) {
    setState(shopifyOrderId, {
      status: 'error',
      errorCode: undefined,
      errorMessage: built.error,
    });
    return;
  }

  setState(shopifyOrderId, {
    status: 'generating',
    startedAt: Date.now(),
    errorCode: undefined,
    errorMessage: undefined,
  });

  void (async () => {
    try {
      const response = await invokeEdgeFunction<
        CreateLabelResponse & { message?: string; delivery_type?: string }
      >('create-envia-label', built.request, { timeoutMs: LABEL_TIMEOUT_MS });

      if (response?.success) {
        const label = response.label;
        const baseCarrier = response.carrier || label?.carrier;
        const officeNote = response.delivery_type === 'oficina' ? ' · reclamo en oficina' : '';
        setState(shopifyOrderId, {
          status: 'ready',
          label,
          carrier: baseCarrier ? `${baseCarrier}${officeNote}` : undefined,
          trackingNumber: response.tracking_number || label?.tracking_number || undefined,
          source: response.message === 'Label already exists' ? 'existing' : 'created',
          readyAt: Date.now(),
        });
      } else {
        setState(shopifyOrderId, {
          status: 'error',
          errorCode: response?.errorCode,
          errorMessage: friendlyLabelError(response?.errorCode, response?.error),
        });
      }
    } catch (error: unknown) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      setState(shopifyOrderId, {
        status: 'error',
        errorCode: aborted ? 'TIMEOUT' : undefined,
        errorMessage: aborted
          ? 'Tiempo agotado — reintentar es seguro (si la guía se creó, se reutiliza)'
          : (error as Error)?.message || 'Error de conexión',
      });
    }
  })();
}

/**
 * Check-and-set atómico del derecho a auto-imprimir. Devuelve true solo la
 * primera vez por pedido (StrictMode-safe: el segundo efecto recibe false).
 */
export function consumeAutoPrint(shopifyOrderId: number): boolean {
  const state = states.get(shopifyOrderId);
  if (!state || state.autoPrintConsumed) return false;
  states.set(shopifyOrderId, { ...state, autoPrintConsumed: true });
  return true;
}

export function useAutoLabelGeneration(shopifyOrderId: number | null | undefined): {
  state: AutoLabelState;
  retry: (order: PickingOrder, organizationId: string) => void;
} {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  // El Map guarda referencias estables por entrada (solo se reemplazan en
  // setState), así getSnapshot devuelve la misma referencia entre renders.
  const getSnapshot = useCallback(
    () => (shopifyOrderId ? states.get(shopifyOrderId) ?? IDLE_STATE : IDLE_STATE),
    [shopifyOrderId]
  );

  const state = useSyncExternalStore(subscribe, getSnapshot);

  const retry = useCallback((order: PickingOrder, organizationId: string) => {
    const id = order.shopify_order?.shopify_order_id;
    if (id) {
      const current = states.get(id);
      if (current?.status === 'error') {
        states.set(id, { ...current, status: 'idle' });
      }
    }
    startAutoLabelGeneration(order, organizationId);
  }, []);

  return { state, retry };
}
