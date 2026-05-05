// ─── useProphitMetrics ─────────────────────────────────────────────
// Single source of truth for all Prophit System metrics (Net Sales,
// Ad Spend, COGS, Shipping, Gateway, Handling, Contribution Margin,
// MER, AMER, Pacing, etc).
//
// Wraps the `/functions/v1/prophit-metrics` Edge Function so the
// dashboard UI and the Growth Manager agent (in Paperclip) share
// EXACTLY the same numbers — no client-side recomputation, no drift.
//
// Drop-in replacement for `useContributionMargin` + `useCostOverrides`.
// The return shape intentionally matches `ContributionMarginData` so
// consumers (ContributionMarginCard, ContributionMarginBreakdown,
// FourQuarterChart, ForecastChart, AdSpendPaceChart, BusinessMetricsRow)
// don't need to change.
//
// Why we migrated: both `useStoreMetrics` (lineItems) and the dashboard's
// `useCostOverrides` silently truncated `product_costs` at 1000 rows
// (Supabase default), which inflated/deflated COGS depending on the
// order Supabase returned rows. Same class of bug in gateway fees.
// The Edge Function paginates everything and gives the true numbers.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import type { DateRange } from './useFinanceDateRange';
import type { ContributionMarginData } from './useContributionMargin';

interface ProphitMetricsResponse {
  current: ContributionMarginData;
  previous: ContributionMarginData | null;
  changes: Record<string, number>;
  metadata: {
    computed_at: string;
    organization_id: string;
    source_tables: string[];
    settings_mode: {
      cogs: string;
      shipping: string;
      gateway: string;
      handling: string;
    };
  };
}

export interface ProphitMetricsResult {
  current: ContributionMarginData;
  previous: ContributionMarginData | null;
  changes: Record<string, number>;
  metadata: ProphitMetricsResponse['metadata'] | null;
  isLoading: boolean;
  error: Error | null;
}

const emptyCM: ContributionMarginData = {
  grossRevenue: 0, returnsAccrual: 0, netSales: 0,
  productCost: 0, shippingCost: 0, paymentGatewayFees: 0, handlingCost: 0,
  variableExpenses: 0, adSpend: 0,
  contributionMargin: 0, cmPercent: 0,
  costOfDeliveryPct: 0, cacPct: 0, opexPct: 0, profitPct: 0,
  costOfDelivery: 0, cacCost: 0, opexCost: 0, profit: 0,
  cmVsTarget: 0, cmVsDailyPace: 0, semaphore: 'red',
  daysInMonth: 30, daysElapsed: 0, daysRemaining: 30,
  dailyPaceTarget: 0, projectedMonthEnd: 0, gapPerDay: 0,
  dailyData: [],
  mer: 0, amer: 0, newCustomerRevenuePct: 0,
  grossMargin: 0, grossMarginPct: 0, shippingCostPct: 0,
  dailyBurn: 0, projectedMonthlyProfit: 0,
};

export function useProphitMetrics(
  currentRange: DateRange,
  previousRange: DateRange,
): ProphitMetricsResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: [
      'prophit-metrics',
      orgId,
      format(currentRange.start, 'yyyy-MM-dd'),
      format(currentRange.end, 'yyyy-MM-dd'),
      format(previousRange.start, 'yyyy-MM-dd'),
      format(previousRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: async (): Promise<ProphitMetricsResponse> => {
      const { data, error } = await supabase.functions.invoke('prophit-metrics', {
        body: {
          organizationId: orgId,
          currentRange: {
            start: currentRange.start.toISOString(),
            end: currentRange.end.toISOString(),
          },
          previousRange: {
            start: previousRange.start.toISOString(),
            end: previousRange.end.toISOString(),
          },
        },
      });
      if (error) throw error;
      return data as ProphitMetricsResponse;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 min — server-side computed, safe to cache
    refetchOnWindowFocus: false,
  });

  return {
    current: query.data?.current ?? emptyCM,
    previous: query.data?.previous ?? null,
    changes: query.data?.changes ?? {},
    metadata: query.data?.metadata ?? null,
    isLoading: query.isLoading,
    error: (query.error as Error) ?? null,
  };
}
