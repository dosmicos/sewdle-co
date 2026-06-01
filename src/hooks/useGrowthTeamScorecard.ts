import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export type KpiStatus = 'green' | 'yellow' | 'red' | 'missing';

export interface GrowthKpi {
  actual: number | null;
  target: number | null;
  gap: number | null;
  progress: number | null;
  status: KpiStatus;
  direction: 'higher_better' | 'lower_better';
}

export interface OwnerScorecard {
  label: string;
  role: string;
  status: KpiStatus;
  kpis: Record<string, GrowthKpi>;
  notes: string[];
}

export interface StaticCreativeProductSummary {
  productKey: string;
  productName: string;
  total: number;
  byPerson: Record<string, number>;
  folderId: string;
  folderUrl: string;
  lastUploadAt: string | null;
}

export interface GrowthTeamScorecardResponse {
  period: { label: string; start: string; end: string };
  milestone: {
    label: string;
    revenue_target: number;
    ad_spend_budget: number;
    mer_target: number;
    cm_percent_target: number;
    new_customers_target: number;
    ugc_content_target: number;
    ugc_active_creators_target: number;
    static_creatives_target: number;
    static_published_target: number;
  };
  company: Record<string, GrowthKpi>;
  owners: {
    julian: OwnerScorecard;
    sebastian: OwnerScorecard;
    angie: OwnerScorecard;
    anaMaria: OwnerScorecard;
  };
  staticCreatives: {
    total: number;
    target: number;
    byPerson: Record<string, number>;
    byProduct: StaticCreativeProductSummary[];
    latestAssets: Array<{ name: string; productName: string; personLabel: string; createdTime: string; webViewLink: string | null }>;
  };
  blockers: Array<{ severity: 'red' | 'yellow'; owner: string; message: string; due?: string }>;
  metadata: { computedAt: string; sources: string[]; missingMetrics: string[]; notes?: string[] };
}

export interface UseGrowthTeamScorecardOptions {
  periodStart?: string;
  periodEnd?: string;
}

export function useGrowthTeamScorecard(options: UseGrowthTeamScorecardOptions = {}) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['growth-team-scorecard', orgId, options.periodStart ?? 'current', options.periodEnd ?? 'current'],
    queryFn: async (): Promise<GrowthTeamScorecardResponse> => {
      const { data, error } = await supabase.functions.invoke('growth-team-scorecard', {
        body: {
          organizationId: orgId,
          periodStart: options.periodStart,
          periodEnd: options.periodEnd,
        },
      });
      if (error) throw error;
      return data as GrowthTeamScorecardResponse;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const syncDriveStatics = useMutation({
    mutationFn: async (daysBack = 45) => {
      const { data, error } = await supabase.functions.invoke('sync-drive-static-creatives', {
        body: { organizationId: orgId, daysBack },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['growth-team-scorecard', orgId] });
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error) ?? null,
    refetch: query.refetch,
    syncDriveStatics,
  };
}
