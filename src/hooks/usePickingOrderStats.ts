import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

const MIN_ORDER_NUMBER = 62303;

export interface PickingOrderStats {
  paraEmpacar: number;
  noConfirmados: number;
  empacados: number;
}

export const usePickingOrderStats = () => {
  const { currentOrganization } = useOrganization();
  const [stats, setStats] = useState<PickingOrderStats>({
    paraEmpacar: 0,
    noConfirmados: 0,
    empacados: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      const orgId = currentOrganization.id;

      // Execute all queries in parallel
      const [paraEmpacarRes, noConfirmadosRes, empacadosRes] = await Promise.all([
        // Para empacar: tags contains 'confirmado', NOT contains 'empacado', specific payment statuses
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .ilike('tags', '%confirmado%')
          .not('tags', 'ilike', '%empacado%')
          .in('financial_status', ['paid', 'pending', 'partially_paid'])
          .or('fulfillment_status.is.null,fulfillment_status.eq.unfulfilled'),

        // No confirmados: tags NOT contains 'confirmado' OR tags IS NULL
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .is('cancelled_at', null)
          .or('tags.is.null,tags.not.ilike.%confirmado%'),

        // Empacados: tags contains 'empacado'
        supabase
          .from('shopify_orders')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('order_number', MIN_ORDER_NUMBER)
          .ilike('tags', '%empacado%'),
      ]);

      setStats({
        paraEmpacar: paraEmpacarRes.count || 0,
        noConfirmados: noConfirmadosRes.count || 0,
        empacados: empacadosRes.count || 0,
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
