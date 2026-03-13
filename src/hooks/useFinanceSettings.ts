import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export type CostMode = 'percent' | 'per_product';
export type ShippingMode = 'percent' | 'shopify_charges' | 'per_order_cost';
export type GatewayMode = 'percent' | 'per_gateway';

export interface FinanceSettings {
  id: string;
  organization_id: string;
  cogs_percent: number;
  shipping_cost_percent: number;
  payment_gateway_percent: number;
  handling_cost_percent: number;
  monthly_opex: number;
  return_rate_percent: number;
  cm_target_percent: number;
  cogs_mode: CostMode;
  shipping_mode: ShippingMode;
  gateway_mode: GatewayMode;
  shipping_cost_per_order: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Omit<FinanceSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'> = {
  cogs_percent: 20,
  shipping_cost_percent: 10,
  payment_gateway_percent: 3.5,
  handling_cost_percent: 2,
  monthly_opex: 0,
  return_rate_percent: 5,
  cm_target_percent: 25,
  cogs_mode: 'per_product',
  shipping_mode: 'per_order_cost',
  gateway_mode: 'percent',
  shipping_cost_per_order: 0,
};

export interface UseFinanceSettingsResult {
  settings: FinanceSettings | null;
  isLoading: boolean;
  updateSettings: (partial: Partial<Omit<FinanceSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  isUpdating: boolean;
}

async function fetchOrCreateSettings(orgId: string): Promise<FinanceSettings> {
  // Try to fetch existing
  const { data, error } = await supabase
    .from('finance_settings')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return data as unknown as FinanceSettings;
  }

  // Auto-create default row
  const { data: created, error: createError } = await supabase
    .from('finance_settings')
    .insert({ organization_id: orgId, ...DEFAULT_SETTINGS })
    .select()
    .single();

  if (createError) throw createError;
  return created as unknown as FinanceSettings;
}

export function useFinanceSettings(): UseFinanceSettingsResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-settings', orgId],
    queryFn: () => fetchOrCreateSettings(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10, // 10 min — rarely changes
  });

  const mutation = useMutation({
    mutationFn: async (partial: Partial<Omit<FinanceSettings, 'id' | 'organization_id' | 'created_at' | 'updated_at'>>) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('finance_settings')
        .update({ ...partial, updated_at: new Date().toISOString() })
        .eq('organization_id', orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-settings', orgId] });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    updateSettings: mutation.mutateAsync,
    isUpdating: mutation.isPending,
  };
}
