import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface CODOrder {
  shopify_order_id: number;
  order_number: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  shipping_address: any;
  total_price: number;
  tags: string | null;
  created_at_shopify: string;
  // From order_confirmations join
  confirmation_status?: string | null;
  confirmation_created_at?: string | null;
  confirmed_at?: string | null;
}

export interface ConfirmationStats {
  total: number;
  notSent: number;
  pending: number;
  confirmed: number;
  needsAttention: number;
}

export const useOrderConfirmations = () => {
  const [orders, setOrders] = useState<CODOrder[]>([]);
  const [stats, setStats] = useState<ConfirmationStats>({ total: 0, notSent: 0, pending: 0, confirmed: 0, needsAttention: 0 });
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { currentOrganization } = useOrganization();
  const { toast } = useToast();

  const orgId = currentOrganization?.id;

  const fetchOrders = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      // 1. Fetch COD orders (Contraentrega, not Confirmado, not cancelled)
      const { data: codOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id, order_number, customer_first_name, customer_last_name, customer_phone, shipping_address, total_price, tags, created_at_shopify')
        .eq('organization_id', orgId)
        .ilike('tags', '%Contraentrega%')
        .is('cancelled_at', null)
        .order('created_at_shopify', { ascending: false })
        .limit(200);

      if (ordersError) {
        console.error('Error fetching COD orders:', ordersError);
        toast({ title: 'Error', description: 'No se pudieron cargar los pedidos COD', variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (!codOrders || codOrders.length === 0) {
        setOrders([]);
        setStats({ total: 0, notSent: 0, pending: 0, confirmed: 0, needsAttention: 0 });
        setLoading(false);
        return;
      }

      // 2. Fetch order_confirmations for these orders
      const orderIds = codOrders.map(o => o.shopify_order_id);
      const { data: confirmations } = await supabase
        .from('order_confirmations')
        .select('shopify_order_id, status, created_at, confirmed_at')
        .in('shopify_order_id', orderIds);

      const confirmMap = new Map<number, any>();
      (confirmations || []).forEach(c => confirmMap.set(c.shopify_order_id, c));

      // 3. Merge data
      const merged: CODOrder[] = codOrders.map(o => {
        const conf = confirmMap.get(o.shopify_order_id);
        // Check if already confirmed via tags
        const isConfirmedByTag = (o.tags || '').toLowerCase().includes('confirmado');
        return {
          ...o,
          confirmation_status: isConfirmedByTag ? 'confirmed' : (conf?.status || null),
          confirmation_created_at: conf?.created_at || null,
          confirmed_at: conf?.confirmed_at || null,
        };
      });

      // 4. Calculate stats
      const total = merged.length;
      const confirmed = merged.filter(o => o.confirmation_status === 'confirmed').length;
      const pending = merged.filter(o => o.confirmation_status === 'pending').length;
      const needsAttention = merged.filter(o => o.confirmation_status === 'needs_attention').length;
      const notSent = merged.filter(o => !o.confirmation_status).length;

      // Sort: needs_attention first, then not_sent, then pending, then confirmed
      const statusOrder: Record<string, number> = { needs_attention: 0, '': 1, pending: 2, confirmed: 3, expired: 4, cancelled: 5 };
      merged.sort((a, b) => {
        const sa = statusOrder[a.confirmation_status || ''] ?? 1;
        const sb = statusOrder[b.confirmation_status || ''] ?? 1;
        return sa - sb;
      });

      setOrders(merged);
      setStats({ total, notSent, pending, confirmed, needsAttention });
    } catch (err) {
      console.error('Error in useOrderConfirmations:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sendSingle = useCallback(async (shopifyOrderId: number) => {
    if (!orgId) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: { action: 'send_single', organizationId: orgId, shopifyOrderId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({ title: 'Enviado', description: 'Confirmacion enviada exitosamente' });
        await fetchOrders(); // Refresh
      } else {
        toast({ title: 'Error', description: data?.error || 'No se pudo enviar la confirmacion', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Error sending confirmation:', err);
      toast({ title: 'Error', description: err.message || 'Error al enviar confirmacion', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }, [orgId, toast, fetchOrders]);

  const sendBulk = useCallback(async () => {
    if (!orgId) return;
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: { action: 'send_bulk', organizationId: orgId }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Envio masivo completado',
          description: `${data.sent} enviadas, ${data.failed} fallidas, ${data.skipped} ya enviadas`
        });
        await fetchOrders(); // Refresh
      } else {
        toast({ title: 'Error', description: data?.error || 'Error en envio masivo', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error('Error sending bulk confirmations:', err);
      toast({ title: 'Error', description: err.message || 'Error en envio masivo', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }, [orgId, toast, fetchOrders]);

  return {
    orders,
    stats,
    loading,
    sending,
    fetchOrders,
    sendSingle,
    sendBulk,
  };
};
