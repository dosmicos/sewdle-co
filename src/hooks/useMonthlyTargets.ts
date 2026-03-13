import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format, startOfMonth } from 'date-fns';

export interface MonthlyTarget {
  id: string;
  organization_id: string;
  month: string; // 'YYYY-MM-DD' (first day)
  revenue_target: number;
  cm_target: number;
  ad_spend_budget: number;
  new_customers_target: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UseMonthlyTargetsResult {
  target: MonthlyTarget | null;
  allTargets: MonthlyTarget[];
  isLoading: boolean;
  upsertTarget: (data: Partial<Omit<MonthlyTarget, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> & { month: string }) => Promise<void>;
  isUpserting: boolean;
}

export function useMonthlyTargets(referenceDate?: Date): UseMonthlyTargetsResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const monthStr = format(startOfMonth(referenceDate ?? new Date()), 'yyyy-MM-dd');

  // Fetch current month's target
  const currentMonthQuery = useQuery({
    queryKey: ['monthly-targets', orgId, monthStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_targets')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('month', monthStr)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as MonthlyTarget) ?? null;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  // Fetch all targets for the settings editor
  const allTargetsQuery = useQuery({
    queryKey: ['monthly-targets', 'all', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_targets')
        .select('*')
        .eq('organization_id', orgId!)
        .order('month', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data as unknown as MonthlyTarget[]) ?? [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<Omit<MonthlyTarget, 'id' | 'organization_id' | 'created_at' | 'updated_at'>> & { month: string }) => {
      if (!orgId) throw new Error('No organization');
      const { error } = await supabase
        .from('monthly_targets')
        .upsert(
          {
            organization_id: orgId,
            month: data.month,
            revenue_target: data.revenue_target ?? 0,
            cm_target: data.cm_target ?? 0,
            ad_spend_budget: data.ad_spend_budget ?? 0,
            new_customers_target: data.new_customers_target ?? 0,
            notes: data.notes ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,month' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-targets'] });
    },
  });

  return {
    target: currentMonthQuery.data ?? null,
    allTargets: allTargetsQuery.data ?? [],
    isLoading: currentMonthQuery.isLoading || allTargetsQuery.isLoading,
    upsertTarget: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
  };
}
