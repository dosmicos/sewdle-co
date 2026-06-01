import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  getAngleDecisionStatus,
  getSpecificAngleLabel,
  type AngleDecisionStatus,
} from '@/lib/angleIntelligence';

export interface AngleWinnerRow {
  specific_angle: string;
  label: string;
  product: string | null;
  creative_type: string | null;
  hook_pattern: string | null;
  best_hook: string | null;
  best_creator: string | null;
  total_spend: number;
  total_revenue: number;
  total_purchases: number;
  roas: number;
  cpa: number;
  ctr: number;
  atc_rate: number | null;
  lp_conv_rate: number | null;
  ad_count: number;
  status: AngleDecisionStatus;
  recommendation: string;
}

interface PerfRow {
  ad_id: string;
  spend: number;
  revenue: number;
  purchases: number;
  clicks: number;
  impressions: number;
  add_to_cart: number | null;
  landing_page_views: number | null;
}

interface TagRow {
  ad_id: string;
  product: string | null;
  product_name: string | null;
  creative_type: string | null;
  hook_description: string | null;
  specific_angle: string | null;
  hook_pattern: string | null;
  ugc_creator_handle: string | null;
}

function recommendationFor(row: Pick<AngleWinnerRow, 'status' | 'label' | 'best_hook'>): string {
  if (row.status === 'winner') {
    return `Pedir 5 variantes más de ${row.label}${row.best_hook ? ` con hook base “${row.best_hook}”` : ''}.`;
  }
  if (row.status === 'promising') {
    return `Mantener en Testing y pedir 2–3 variantes controladas de ${row.label}.`;
  }
  if (row.status === 'loser') {
    return `No pedir más piezas de ${row.label} hasta revisar hook/oferta/landing.`;
  }
  return `Necesita más data antes de convertirlo en brief para el equipo.`;
}

async function fetchAngleWinners(orgId: string, periodType: '7d' | '30d'): Promise<AngleWinnerRow[]> {
  const now = new Date();
  const start = subDays(now, periodType === '7d' ? 7 : 30);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(now, 'yyyy-MM-dd');

  const { data: perfData, error } = await supabase
    .from('ad_performance_daily')
    .select('ad_id, spend, revenue, purchases, clicks, impressions, add_to_cart, landing_page_views')
    .eq('organization_id', orgId)
    .gte('date', startStr)
    .lte('date', endStr);

  if (error) {
    console.error('Error fetching angle performance data:', error);
    return [];
  }

  const rows = (perfData || []) as unknown as PerfRow[];
  const adIds = Array.from(new Set(rows.map((row) => row.ad_id).filter(Boolean)));
  if (adIds.length === 0) return [];

  const tagsMap = new Map<string, TagRow>();
  const TAG_BATCH_SIZE = 500;

  for (let i = 0; i < adIds.length; i += TAG_BATCH_SIZE) {
    const batch = adIds.slice(i, i + TAG_BATCH_SIZE);
    const { data: tagsData, error: tagsError } = await supabase
      .from('ad_tags')
      .select('ad_id, product, product_name, creative_type, hook_description, specific_angle, hook_pattern, ugc_creator_handle')
      .eq('organization_id', orgId)
      .in('ad_id', batch);

    if (tagsError) {
      console.error('Error fetching angle tags:', tagsError);
      return [];
    }

    for (const tag of (tagsData || []) as TagRow[]) {
      tagsMap.set(tag.ad_id, tag);
    }
  }

  const groups = new Map<string, {
    adIds: Set<string>;
    spend: number;
    revenue: number;
    purchases: number;
    clicks: number;
    impressions: number;
    atc: number;
    lpv: number;
    productCounts: Map<string, number>;
    creativeCounts: Map<string, number>;
    hookPatternCounts: Map<string, number>;
    hookRevenue: Map<string, number>;
    creatorRevenue: Map<string, number>;
  }>();

  const addCount = (map: Map<string, number>, key: string | null | undefined, increment: number = 1) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + increment);
  };

  for (const row of rows) {
    const tag = tagsMap.get(row.ad_id);
    const angle = tag?.specific_angle;
    if (!angle || angle === 'unknown') continue;

    if (!groups.has(angle)) {
      groups.set(angle, {
        adIds: new Set(),
        spend: 0,
        revenue: 0,
        purchases: 0,
        clicks: 0,
        impressions: 0,
        atc: 0,
        lpv: 0,
        productCounts: new Map(),
        creativeCounts: new Map(),
        hookPatternCounts: new Map(),
        hookRevenue: new Map(),
        creatorRevenue: new Map(),
      });
    }

    const group = groups.get(angle)!;
    const spend = Number(row.spend) || 0;
    const revenue = Number(row.revenue) || 0;

    group.adIds.add(row.ad_id);
    group.spend += spend;
    group.revenue += revenue;
    group.purchases += Number(row.purchases) || 0;
    group.clicks += Number(row.clicks) || 0;
    group.impressions += Number(row.impressions) || 0;
    group.atc += Number(row.add_to_cart) || 0;
    group.lpv += Number(row.landing_page_views) || 0;

    addCount(group.productCounts, tag?.product_name || tag?.product);
    addCount(group.creativeCounts, tag?.creative_type);
    addCount(group.hookPatternCounts, tag?.hook_pattern);
    addCount(group.hookRevenue, tag?.hook_description, revenue);
    addCount(group.creatorRevenue, tag?.ugc_creator_handle, revenue);
  }

  const topByValue = (map: Map<string, number>): string | null => {
    const [top] = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return top?.[0] || null;
  };

  const result = Array.from(groups.entries()).map(([angle, group]) => {
    const roas = group.spend > 0 ? group.revenue / group.spend : 0;
    const cpa = group.purchases > 0 ? group.spend / group.purchases : 0;
    const ctr = group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
    const atcRate = group.lpv > 0 ? (group.atc / group.lpv) * 100 : null;
    const lpConvRate = group.lpv > 0 ? (group.purchases / group.lpv) * 100 : null;
    const adCount = group.adIds.size;
    const status = getAngleDecisionStatus({ spend: group.spend, purchases: group.purchases, roas, cpa, adCount });
    const base = {
      specific_angle: angle,
      label: getSpecificAngleLabel(angle),
      product: topByValue(group.productCounts),
      creative_type: topByValue(group.creativeCounts),
      hook_pattern: topByValue(group.hookPatternCounts),
      best_hook: topByValue(group.hookRevenue),
      best_creator: topByValue(group.creatorRevenue),
      total_spend: group.spend,
      total_revenue: group.revenue,
      total_purchases: group.purchases,
      roas,
      cpa,
      ctr,
      atc_rate: atcRate,
      lp_conv_rate: lpConvRate,
      ad_count: adCount,
      status,
    };

    return {
      ...base,
      recommendation: recommendationFor(base),
    };
  });

  return result.sort((a, b) => {
    const statusRank = { winner: 0, promising: 1, needs_data: 2, loser: 3 } as const;
    const statusDiff = statusRank[a.status] - statusRank[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (b.total_purchases !== a.total_purchases) return b.total_purchases - a.total_purchases;
    return b.roas - a.roas;
  });
}

export function useAngleWinners(periodType: '7d' | '30d' = '7d') {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['angle-winners', orgId, periodType],
    queryFn: () => fetchAngleWinners(orgId!, periodType),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    angles: data ?? [],
    winners: (data ?? []).filter((row) => row.status === 'winner'),
    promising: (data ?? []).filter((row) => row.status === 'promising'),
    losers: (data ?? []).filter((row) => row.status === 'loser'),
    isLoading,
  };
}
