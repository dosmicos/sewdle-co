import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const SHIPPING_LABEL_PRESENCE_KEY = 'shipping-label-presence';

// Set de shopify_order_id que ya tienen guía activa (no cancelada/error).
// Una sola query liviana por página de la lista; staleTime corto para
// reflejar guías generadas en el modal sin recargar.
export function useShippingLabelPresence(
  shopifyOrderIds: number[],
  organizationId: string | undefined
): Set<number> {
  const sortedIds = useMemo(() => [...shopifyOrderIds].sort((a, b) => a - b), [shopifyOrderIds]);

  const { data } = useQuery({
    queryKey: [SHIPPING_LABEL_PRESENCE_KEY, organizationId, sortedIds.join(',')],
    enabled: !!organizationId && sortedIds.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_labels')
        .select('shopify_order_id')
        .eq('organization_id', organizationId!)
        .in('shopify_order_id', sortedIds)
        .not('status', 'in', '(cancelled,error)');
      if (error) throw error;
      return (data ?? []).map(row => row.shopify_order_id as number);
    },
  });

  return useMemo(() => new Set(data ?? []), [data]);
}
