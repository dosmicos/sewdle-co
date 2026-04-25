import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { type DateRange } from './useFinanceDateRange';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';

export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  purchases: number;
  cpc: number;
  cpm: number;
  ctr: number;
  roas: number;
  cpa: number;
  dailyData: { date: string; spend: number; roas: number; purchases: number }[];
}

export interface AdMetricsResult {
  current: AdMetrics;
  previous: AdMetrics;
  changes: Record<string, number>;
  isLoading: boolean;
}

const emptyMetrics: AdMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversionValue: 0,
  purchases: 0,
  cpc: 0,
  cpm: 0,
  ctr: 0,
  roas: 0,
  cpa: 0,
  dailyData: [],
};

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchAdMetrics(
  orgId: string,
  dateRange: DateRange,
  platform: 'meta' | 'google_ads' | 'tiktok_ads'
): Promise<AdMetrics> {
  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr = format(dateRange.end, 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('ad_metrics_daily')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', platform)
    .gte('date', startStr)
    .lte('date', endStr)
    .order('date', { ascending: true });

  if (error) {
    console.error(`Error fetching ${platform} metrics:`, error);
    return { ...emptyMetrics };
  }

  if (!data || data.length === 0) {
    return { ...emptyMetrics };
  }

  // Aggregate metrics
  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalConversionValue = 0;
  let totalPurchases = 0;

  const dailyData: AdMetrics['dailyData'] = [];

  for (const row of data) {
    const spend = Number(row.spend) || 0;
    const impressions = Number(row.impressions) || 0;
    const clicks = Number(row.clicks) || 0;
    const conversions = Number(row.conversions) || 0;
    const conversionValue = Number(row.conversion_value) || 0;
    const purchases = Number(row.purchases) || 0;

    totalSpend += spend;
    totalImpressions += impressions;
    totalClicks += clicks;
    totalConversions += conversions;
    totalConversionValue += conversionValue;
    totalPurchases += purchases;

    dailyData.push({
      date: row.date,
      spend,
      roas: spend > 0 ? conversionValue / spend : 0,
      purchases,
    });
  }

  // Calculate aggregate rates
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const roas = totalSpend > 0 ? totalConversionValue / totalSpend : 0;
  const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  return {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    conversions: totalConversions,
    conversionValue: totalConversionValue,
    purchases: totalPurchases,
    cpc,
    cpm,
    ctr,
    roas,
    cpa,
    dailyData,
  };
}

export function useAdMetrics(
  currentRange: DateRange,
  previousRange: DateRange,
  platform: 'meta' | 'google_ads' | 'tiktok_ads' = 'meta'
): AdMetricsResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const currentQuery = useQuery({
    queryKey: [
      'ad-metrics',
      platform,
      'current',
      orgId,
      format(currentRange.start, 'yyyy-MM-dd'),
      format(currentRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: () => fetchAdMetrics(orgId!, currentRange, platform),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const previousQuery = useQuery({
    queryKey: [
      'ad-metrics',
      platform,
      'previous',
      orgId,
      format(previousRange.start, 'yyyy-MM-dd'),
      format(previousRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: () => fetchAdMetrics(orgId!, previousRange, platform),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const current = currentQuery.data ?? { ...emptyMetrics };
  const previous = previousQuery.data ?? { ...emptyMetrics };

  const changes: Record<string, number> = {
    spend: calcChange(current.spend, previous.spend),
    impressions: calcChange(current.impressions, previous.impressions),
    clicks: calcChange(current.clicks, previous.clicks),
    conversions: calcChange(current.conversions, previous.conversions),
    conversionValue: calcChange(current.conversionValue, previous.conversionValue),
    purchases: calcChange(current.purchases, previous.purchases),
    cpc: calcChange(current.cpc, previous.cpc),
    cpm: calcChange(current.cpm, previous.cpm),
    ctr: calcChange(current.ctr, previous.ctr),
    roas: calcChange(current.roas, previous.roas),
    cpa: calcChange(current.cpa, previous.cpa),
  };

  return {
    current,
    previous,
    changes,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
  };
}
