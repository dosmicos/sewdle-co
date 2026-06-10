import { useCallback, useMemo, useRef, useState } from 'react';
import type { PickingOrder } from '@/hooks/usePickingOrders';
import type { CreateLabelRequest, CreateLabelResponse } from '../types/envia';
import { invokeEdgeFunction } from '../lib/invokeEdgeFunction';
import { buildCreateLabelRequest, friendlyLabelError } from '../lib/orderLabelUtils';

export type BulkItemStatus =
  | 'pending'
  | 'generating'
  | 'success'
  | 'already_had_label'
  | 'error'
  | 'cancelled';

export interface BulkLabelItem {
  orderId: string; // picking_packing_orders.id
  shopifyOrderId: number;
  orderNumber: string;
  status: BulkItemStatus;
  trackingNumber?: string;
  labelUrl?: string;
  carrier?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface BulkSummary {
  total: number;
  done: number;
  succeeded: number;
  alreadyHad: number;
  failed: number;
}

const CONCURRENCY = 3;
const LABEL_TIMEOUT_MS = 45_000;

// Tope por tanda: protege la cuota de Envia y mantiene el batch manejable.
export const MAX_BULK_LABELS = 100;

export const useBulkLabelGeneration = () => {
  const [items, setItems] = useState<BulkLabelItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);
  const requestsRef = useRef<Map<string, CreateLabelRequest>>(new Map());

  const updateItem = useCallback((orderId: string, patch: Partial<BulkLabelItem>) => {
    setItems(prev => prev.map(item => (item.orderId === orderId ? { ...item, ...patch } : item)));
  }, []);

  const generateOne = useCallback(async (orderId: string) => {
    const request = requestsRef.current.get(orderId);
    if (!request) {
      updateItem(orderId, { status: 'error', errorMessage: 'Pedido sin datos de envío' });
      return;
    }

    updateItem(orderId, { status: 'generating', errorCode: undefined, errorMessage: undefined });

    try {
      const response = await invokeEdgeFunction<CreateLabelResponse & { message?: string }>(
        'create-envia-label',
        request,
        { timeoutMs: LABEL_TIMEOUT_MS }
      );

      if (response?.success) {
        const label = response.label;
        const baseCarrier = response.carrier || label?.carrier;
        const officeNote = (response as { delivery_type?: string }).delivery_type === 'oficina'
          ? ' · reclamo en oficina'
          : '';
        updateItem(orderId, {
          status: response.message === 'Label already exists' ? 'already_had_label' : 'success',
          trackingNumber: response.tracking_number || label?.tracking_number || undefined,
          labelUrl: response.label_url || label?.label_url || undefined,
          carrier: baseCarrier ? `${baseCarrier}${officeNote}` : undefined,
        });
      } else {
        updateItem(orderId, {
          status: 'error',
          errorCode: response?.errorCode,
          errorMessage: friendlyLabelError(response?.errorCode, response?.error),
        });
      }
    } catch (error: any) {
      const aborted = error?.name === 'AbortError';
      updateItem(orderId, {
        status: 'error',
        errorCode: aborted ? 'TIMEOUT' : undefined,
        errorMessage: aborted
          ? 'Tiempo agotado — reintentar es seguro (si la guía se creó, se reutiliza)'
          : error?.message || 'Error de conexión',
      });
    }
  }, [updateItem]);

  const runQueue = useCallback(async (orderIds: string[]) => {
    const queue = [...orderIds];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        if (cancelRef.current) {
          const remaining = queue.splice(0, queue.length);
          remaining.forEach(orderId => updateItem(orderId, { status: 'cancelled' }));
          break;
        }
        const orderId = queue.shift();
        if (!orderId) break;
        await generateOne(orderId);
      }
    });
    await Promise.all(workers);
  }, [generateOne, updateItem]);

  const start = useCallback(async (allOrders: PickingOrder[], organizationId: string) => {
    if (isRunning || allOrders.length === 0) return;
    const orders = allOrders.slice(0, MAX_BULK_LABELS);

    cancelRef.current = false;
    requestsRef.current = new Map();

    const initialItems: BulkLabelItem[] = orders.map(order => {
      const built = buildCreateLabelRequest(order, organizationId);
      if (built.ok) {
        requestsRef.current.set(order.id, built.request);
        return {
          orderId: order.id,
          shopifyOrderId: order.shopify_order_id,
          orderNumber: order.shopify_order?.order_number || String(order.shopify_order_id),
          status: 'pending' as const,
        };
      }
      return {
        orderId: order.id,
        shopifyOrderId: order.shopify_order_id,
        orderNumber: order.shopify_order?.order_number || String(order.shopify_order_id),
        status: 'error' as const,
        errorMessage: built.error,
      };
    });

    setItems(initialItems);
    setIsRunning(true);
    try {
      await runQueue(initialItems.filter(item => item.status === 'pending').map(item => item.orderId));
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, runQueue]);

  const retryItem = useCallback(async (orderId: string) => {
    if (isRunning) return;
    setIsRunning(true);
    cancelRef.current = false;
    try {
      await generateOne(orderId);
    } finally {
      setIsRunning(false);
    }
  }, [generateOne, isRunning]);

  const retryAllFailed = useCallback(async () => {
    if (isRunning) return;
    const failedIds = items
      .filter(item => item.status === 'error' || item.status === 'cancelled')
      .filter(item => requestsRef.current.has(item.orderId))
      .map(item => item.orderId);
    if (failedIds.length === 0) return;

    setIsRunning(true);
    cancelRef.current = false;
    try {
      await runQueue(failedIds);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, items, runQueue]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = false;
    requestsRef.current = new Map();
    setItems([]);
    setIsRunning(false);
  }, []);

  const summary: BulkSummary = useMemo(() => {
    const succeeded = items.filter(item => item.status === 'success').length;
    const alreadyHad = items.filter(item => item.status === 'already_had_label').length;
    const failed = items.filter(item => item.status === 'error' || item.status === 'cancelled').length;
    return {
      total: items.length,
      done: succeeded + alreadyHad + failed,
      succeeded,
      alreadyHad,
      failed,
    };
  }, [items]);

  return { items, isRunning, summary, start, cancel, retryItem, retryAllFailed, reset };
};
