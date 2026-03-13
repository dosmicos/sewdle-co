import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCallback } from 'react';

export interface GatewayCostSetting {
  id: string;
  organization_id: string;
  gateway_name: string;
  percent_fee: number;
  flat_fee: number;
  is_active: boolean;
  applies_to_all: boolean;
  created_at: string;
}

export function useGatewayCosts() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  // Fetch saved gateway cost settings
  const query = useQuery({
    queryKey: ['gateway-costs', orgId],
    queryFn: async (): Promise<GatewayCostSetting[]> => {
      const { data, error } = await supabase
        .from('gateway_cost_settings')
        .select('*')
        .eq('organization_id', orgId!)
        .order('gateway_name');

      if (error) throw error;
      return (data as unknown as GatewayCostSetting[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  // Detect gateways from recent orders' raw_data
  const detectedQuery = useQuery({
    queryKey: ['detected-gateways', orgId],
    queryFn: async (): Promise<string[]> => {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const { data, error } = await supabase
        .from('shopify_orders')
        .select('raw_data')
        .eq('organization_id', orgId!)
        .gte('created_at_shopify', threeMonthsAgo.toISOString())
        .is('cancelled_at', null)
        .limit(1000);

      if (error) throw error;

      const gatewaySet = new Set<string>();
      for (const order of data || []) {
        const raw = order.raw_data as Record<string, unknown> | null;
        if (!raw) continue;
        const names = raw.payment_gateway_names as string[] | undefined;
        if (names && Array.isArray(names)) {
          for (const name of names) {
            if (name) gatewaySet.add(name);
          }
        }
      }

      return Array.from(gatewaySet).sort();
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      gateway_name,
      percent_fee,
      flat_fee,
      is_active,
    }: {
      gateway_name: string;
      percent_fee?: number;
      flat_fee?: number;
      is_active?: boolean;
    }) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('gateway_cost_settings')
        .upsert(
          {
            organization_id: orgId,
            gateway_name,
            ...(percent_fee !== undefined && { percent_fee }),
            ...(flat_fee !== undefined && { flat_fee }),
            ...(is_active !== undefined && { is_active }),
          },
          { onConflict: 'organization_id,gateway_name' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gateway-costs', orgId] });
    },
  });

  // Compute total gateway fees for a set of orders
  const computeGatewayFees = useCallback(
    (
      orders: Array<{
        total_price: number;
        raw_data?: Record<string, unknown> | null;
      }>
    ): number => {
      const gateways = query.data || [];
      const gatewayMap = new Map(gateways.map((g) => [g.gateway_name, g]));
      let total = 0;

      for (const order of orders) {
        const raw = order.raw_data;
        if (!raw) continue;

        const names = (raw.payment_gateway_names as string[]) || [];
        // Use the last (effective) gateway
        const effectiveGateway = names.length > 0 ? names[names.length - 1] : null;
        if (!effectiveGateway) continue;

        const setting = gatewayMap.get(effectiveGateway);
        if (setting && setting.is_active) {
          total += order.total_price * (setting.percent_fee / 100) + setting.flat_fee;
        }
      }
      return total;
    },
    [query.data]
  );

  return {
    gateways: query.data || [],
    detectedGateways: detectedQuery.data || [],
    isLoading: query.isLoading,
    isDetecting: detectedQuery.isLoading,
    upsertGateway: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    computeGatewayFees,
  };
}
