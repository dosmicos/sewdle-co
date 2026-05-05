import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface ExpressOrder {
  shopify_order_id: number;
  order_number: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  shipping_address: any;
  total_price: number;
  tags: string | null;
  note: string | null;
  raw_data: any;
  created_at_shopify: string;
  // From express_notifications join
  notification_status?: string | null;
  delivery_code_from_note?: string | null;
  sent_at?: string | null;
}

export interface ExpressStats {
  total: number;
  notSent: number;
  sent: number;
  noCode: number;
}

function extractDeliveryCode(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/c[oó]digo[:\s]*\s*([a-zA-Z0-9]+)/i);
  return match?.[1] || null;
}

export const useExpressNotifications = () => {
  const [orders, setOrders] = useState<ExpressOrder[]>([]);
  const [stats, setStats] = useState<ExpressStats>({ total: 0, notSent: 0, sent: 0, noCode: 0 });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [manualCodes, setManualCodes] = useState<Record<number, string>>({});
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const orgId = currentOrganization?.id;

  const fetchOrders = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // Fetch shipped orders
      const { data: shippedOrders, error } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, total_price, tags, note, raw_data, created_at_shopify')
        .eq('organization_id', orgId)
        .ilike('tags', '%ENVIADO%')
        .is('cancelled_at', null)
        .order('created_at_shopify', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching express orders:', error);
        toast({ title: 'Error', description: 'No se pudieron cargar los pedidos express', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Filter only express orders (by shipping line)
      const expressOrders = (shippedOrders || []).filter(o => {
        const shippingTitle = o.raw_data?.shipping_lines?.[0]?.title || '';
        return shippingTitle.toLowerCase().includes('express');
      });

      if (expressOrders.length === 0) {
        setOrders([]);
        setStats({ total: 0, notSent: 0, sent: 0, noCode: 0 });
        setLoading(false);
        return;
      }

      // Fetch notification status
      const orderIds = expressOrders.map(o => o.shopify_order_id);
      const { data: notifications } = await supabase
        .from('express_notifications')
        .select('shopify_order_id, status, sent_at, delivery_code')
        .in('shopify_order_id', orderIds);

      const notifMap = new Map<number, any>();
      (notifications || []).forEach(n => notifMap.set(n.shopify_order_id, n));

      // Merge
      const merged: ExpressOrder[] = expressOrders.map(o => {
        const notif = notifMap.get(o.shopify_order_id);
        const codeFromNote = extractDeliveryCode(o.note);
        return {
          ...o,
          notification_status: notif?.status || null,
          delivery_code_from_note: codeFromNote,
          sent_at: notif?.sent_at || null,
        };
      });

      // Stats
      const total = merged.length;
      const sent = merged.filter(o => o.notification_status === 'sent').length;
      const notSentOrders = merged.filter(o => !o.notification_status || o.notification_status === 'failed');
      const noCode = notSentOrders.filter(o => !o.delivery_code_from_note).length;
      const notSent = notSentOrders.length;

      // Sort: failed first, then no-notification with code, then no-notification no-code, then sent
      const statusOrder: Record<string, number> = { failed: 0, '': 1, sent: 2 };
      merged.sort((a, b) => {
        const sa = statusOrder[a.notification_status || ''] ?? 1;
        const sb = statusOrder[b.notification_status || ''] ?? 1;
        if (sa !== sb) return sa - sb;
        // Within same status, orders with code first
        const ca = a.delivery_code_from_note ? 0 : 1;
        const cb = b.delivery_code_from_note ? 0 : 1;
        return ca - cb;
      });

      setOrders(merged);
      setStats({ total, notSent, sent, noCode });
    } catch (err) {
      console.error('Error in useExpressNotifications:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const setManualCode = useCallback((shopifyOrderId: number, code: string) => {
    setManualCodes(prev => ({ ...prev, [shopifyOrderId]: code }));
  }, []);

  const getDeliveryCode = useCallback((order: ExpressOrder): string => {
    return manualCodes[order.shopify_order_id] || order.delivery_code_from_note || '';
  }, [manualCodes]);

  const sendSingle = useCallback(async (shopifyOrderId: number, deliveryCode: string) => {
    if (!orgId || !deliveryCode) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-express-notification', {
        body: { action: 'send_single', organizationId: orgId, shopifyOrderId, deliveryCode }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Enviado', description: 'Notificacion express enviada exitosamente' });
        await fetchOrders();
      } else {
        toast({ title: 'Error', description: data?.error || 'No se pudo enviar la notificacion', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Error sending express notification:', err);
      toast({ title: 'Error', description: err.message || 'Error al enviar notificacion', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }, [orgId, toast, fetchOrders]);

  const sendBulk = useCallback(async () => {
    if (!orgId) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-express-notification', {
        body: { action: 'send_bulk', organizationId: orgId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Envio masivo completado',
          description: `${data.sent} enviadas, ${data.failed} fallidas, ${data.noCode} sin codigo`
        });
        await fetchOrders();
      } else {
        toast({ title: 'Error', description: data?.error || 'Error en envio masivo', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Error sending bulk notifications:', err);
      toast({ title: 'Error', description: err.message || 'Error en envio masivo', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }, [orgId, toast, fetchOrders]);

  return {
    orders, stats, loading, sending,
    fetchOrders, sendSingle, sendBulk,
    manualCodes, setManualCode, getDeliveryCode,
  };
};
