import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { type DateRange } from './useFinanceDateRange';
import { format } from 'date-fns';

export interface TikTokAdBreakdownRow {
  tiktok_ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  adgroup_name: string | null;
  ad_text: string | null;
  video_id: string | null;
  image_urls: string[];
  landing_url: string | null;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  purchases: number;
  video_views: number;
  video_views_p25: number;
  video_views_p50: number;
  video_views_p75: number;
  video_views_p100: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cvr: number;
  roas: number;
  cpa: number;
  hold_rate: number;
}

async function fetchBreakdown(
  orgId: string,
  range: DateRange
): Promise<TikTokAdBreakdownRow[]> {
  const startStr = format(range.start, 'yyyy-MM-dd');
  const endStr = format(range.end, 'yyyy-MM-dd');

  const { data: metrics, error: metricsError } = await supabase
    .from('tiktok_ad_metrics_daily')
    .select('*')
    .eq('organization_id', orgId)
    .gte('date', startStr)
    .lte('date', endStr);

  if (metricsError) {
    console.error('Error fetching tiktok_ad_metrics_daily:', metricsError);
    return [];
  }

  if (!metrics || metrics.length === 0) return [];

  const adIds = Array.from(new Set(metrics.map((m: any) => m.tiktok_ad_id)));

  const { data: ads, error: adsError } = await supabase
    .from('tiktok_ads')
    .select('*')
    .eq('organization_id', orgId)
    .in('tiktok_ad_id', adIds);

  if (adsError) {
    console.error('Error fetching tiktok_ads:', adsError);
  }

  const adsMap = new Map<string, any>();
  for (const a of ads || []) adsMap.set(a.tiktok_ad_id, a);

  const aggMap = new Map<string, TikTokAdBreakdownRow>();

  for (const m of metrics as any[]) {
    const adId = m.tiktok_ad_id as string;
    const meta = adsMap.get(adId);

    let row = aggMap.get(adId);
    if (!row) {
      row = {
        tiktok_ad_id: adId,
        ad_name: meta?.ad_name ?? null,
        campaign_name: meta?.campaign_name ?? null,
        adgroup_name: meta?.adgroup_name ?? null,
        ad_text: meta?.ad_text ?? null,
        video_id: meta?.video_id ?? null,
        image_urls: meta?.image_urls ?? [],
        landing_url: meta?.landing_url ?? null,
        status: meta?.status ?? null,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
        purchases: 0,
        video_views: 0,
        video_views_p25: 0,
        video_views_p50: 0,
        video_views_p75: 0,
        video_views_p100: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        cvr: 0,
        roas: 0,
        cpa: 0,
        hold_rate: 0,
      };
      aggMap.set(adId, row);
    }

    row.spend += Number(m.spend) || 0;
    row.impressions += Number(m.impressions) || 0;
    row.clicks += Number(m.clicks) || 0;
    row.conversions += Number(m.conversions) || 0;
    row.conversion_value += Number(m.conversion_value) || 0;
    row.purchases += Number(m.purchases) || 0;
    row.video_views += Number(m.video_views) || 0;
    row.video_views_p25 += Number(m.video_views_p25) || 0;
    row.video_views_p50 += Number(m.video_views_p50) || 0;
    row.video_views_p75 += Number(m.video_views_p75) || 0;
    row.video_views_p100 += Number(m.video_views_p100) || 0;
  }

  for (const row of aggMap.values()) {
    row.ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    row.cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
    row.cpm = row.impressions > 0 ? (row.spend / row.impressions) * 1000 : 0;
    row.cvr = row.clicks > 0 ? (row.purchases / row.clicks) * 100 : 0;
    row.roas = row.spend > 0 ? row.conversion_value / row.spend : 0;
    row.cpa = row.purchases > 0 ? row.spend / row.purchases : 0;
    row.hold_rate =
      row.video_views > 0 ? (row.video_views_p100 / row.video_views) * 100 : 0;
  }

  return Array.from(aggMap.values()).sort((a, b) => b.spend - a.spend);
}

export function useTikTokAdsBreakdown(range: DateRange) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: [
      'tiktok-ads-breakdown',
      orgId,
      format(range.start, 'yyyy-MM-dd'),
      format(range.end, 'yyyy-MM-dd'),
    ],
    queryFn: () => fetchBreakdown(orgId!, range),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  return {
    rows: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
