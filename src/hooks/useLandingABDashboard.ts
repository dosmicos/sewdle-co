import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface VariantStats {
  lpVersion: string;
  label: string;
  role: 'control' | 'challenger';
  visits: number;
  orders: number;
  revenue: number;
  cvr: number | null; // orders / visits (0..1)
  aov: number | null; // revenue / orders
  rpv: number | null; // revenue / visits
}

export interface SignificanceResult {
  upliftPct: number | null; // already in %
  z: number | null;
  pValue: number | null;
  confidencePct: number | null; // already in %
  significant: boolean;
  winner: 'control' | 'challenger' | 'tie' | null;
}

export interface TimePoint {
  day: string;
  controlVisits: number;
  controlOrders: number;
  controlCvr: number | null;
  challengerVisits: number;
  challengerOrders: number;
  challengerCvr: number | null;
}

export interface ExperimentSummary {
  slug: string;
  name: string;
  destinationPath: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  daysRunning: number;
  control: VariantStats;
  challenger: VariantStats;
  significance: SignificanceResult;
  timeseries: TimePoint[];
}

export interface LandingAbDashboardResponse {
  period: { start: string; end: string };
  experiments: ExperimentSummary[];
  metadata: { computedAt: string; notes: string[] };
}

export interface UseLandingABDashboardOptions {
  periodStart?: string;
  periodEnd?: string;
  experimentSlug?: string;
}

export function useLandingABDashboard(options: UseLandingABDashboardOptions = {}) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: ['landing-ab-dashboard', orgId, options.periodStart ?? 'def', options.periodEnd ?? 'def', options.experimentSlug ?? 'all'],
    queryFn: async (): Promise<LandingAbDashboardResponse> => {
      const { data, error } = await supabase.functions.invoke('landing-ab-dashboard', {
        body: {
          organizationId: orgId,
          periodStart: options.periodStart,
          periodEnd: options.periodEnd,
          experimentSlug: options.experimentSlug,
        },
      });
      if (error) throw error;
      return data as LandingAbDashboardResponse;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error) ?? null,
    refetch: query.refetch,
  };
}
