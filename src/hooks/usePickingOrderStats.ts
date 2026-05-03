import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const MIN_ORDER_NUMBER = 62303;

export interface PickingOrderStats {
  paraEmpacar: number;
  noConfirmados: number;
  express: number;
  empacados: number;
  bordados: number;
}

export const usePickingOrderStats = () => {
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState<PickingOrderStats>({
    paraEmpacar: 0,
    noConfirmados: 0,
    express: 0,
    empacados: 0,
    bordados: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      const orgId = currentOrganization.id;

      // Execute all queries in parallel
      const [paraEmpacarRes, noConfirmadosRes, expressRes, empacadosRes, bordadosRes] = await Promise.all([
        // Para empacar: confirmado + NOT empacado + NOT bordado + NOT express shipping
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .ilike('tags', '%confirmado%')
          .not('tags', 'ilike', '%empacado%')
          .not('tags', 'ilike', '%bordado%')
          .not('raw_data->shipping_lines->0->>title', 'ilike', '%Express%')
          .in('financial_status', ['paid', 'pending', 'partially_paid'])
          .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.partial'),

        // No confirmados: sin tag confirmado + pago pendiente + no cancelado
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .eq('financial_status', 'pending')
          .or('tags.is.null,tags.not.ilike.%confirmado%')
          .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.partial'),

        // Express: confirmado + NOT empacado + shipping method contiene "Express"
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .ilike('tags', '%confirmado%')
          .not('tags', 'ilike', '%empacado%')
          .filter('raw_data->shipping_lines->0->>title', 'ilike', '%Express%')
          .in('financial_status', ['paid', 'pending', 'partially_paid'])
          .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.partial'),

        // Empacados: tags contains 'empacado'
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .ilike('tags', '%empacado%'),

        // Bordados: confirmado + BORDADO + NOT empacado
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .ilike('tags', '%confirmado%')
          .ilike('tags', '%bordado%')
          .not('tags', 'ilike', '%empacado%')
          .in('financial_status', ['paid', 'pending', 'partially_paid'])
          .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled,fulfillment_status.eq.partial'),
      ]);

      setStats({
        paraEmpacar: paraEmpacarRes.count || 0,
        noConfirmados: noConfirmadosRes.count || 0,
        express: expressRes.count || 0,
        empacados: empacadosRes.count || 0,
        bordados: bordadosRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching picking order stats:', error);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Initial fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel('picking-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopify_orders',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, fetchStats]);

  return { stats, loading, refetch: fetchStats };
};
