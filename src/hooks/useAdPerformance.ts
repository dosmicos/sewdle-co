import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { type DateRange } from './useFinanceDateRange';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface AdPerformanceRow {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  cpm: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  purchases: number;
  revenue: number;
  add_to_cart: number;
  initiate_checkout: number;
  landing_page_views: number;
  video_thruplay: number | null;
  video_p25: number | null;
  video_p50: number | null;
  video_p75: number | null;
  video_p95: number | null;
  video_p100: number | null;
  video_avg_time: number | null;
  roas: number;
  cpa: number;
  // AMER / NC-ROAS metrics
  new_customer_pct: number;
  estimated_new_revenue: number;
  amer: number;
  nc_roas: number;
  hook_rate: number | null;
  hold_rate: number | null;
  lp_conv_rate: number | null;
  atc_rate: number | null;
  // Calculated in aggregation
  atc_to_purchase: number | null;
  checkout_rate: number | null;
  // Trend for 7-day view
  trend?: 'up' | 'down' | 'stable';
  // Daily data for expanded row charts
  dailyData?: { date: string; roas: number; spend: number }[];
  // Intelligence data (merged from ad_tags / ad_creative_content / ad_lifecycle)
  tags?: {
    creative_type?: string | null;
    sales_angle?: string | null;
    copy_type?: string | null;
    hook_description?: string | null;
    product?: string | null;
    product_name?: string | null;
    offer_type?: string | null;
    offer_value?: string | null;
    funnel_stage?: string | null;
    audience_type?: string | null;
    audience_type_detail?: string | null;
    is_advantage_plus?: boolean | null;
    target_country?: string | null;
    ugc_creator_handle?: string | null;
    confidence?: string | null;
  };
  media_type?: string | null;
  phase?: string | null;
}

export interface AdPerformanceResult {
  ads: AdPerformanceRow[];
  isLoading: boolean;
  syncing: boolean;
  syncAdPerformance: (startDate: string, endDate: string) => Promise<boolean>;
}

async function fetchNewCustomerPercentage(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  // Query shopify_orders for the date range
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('total_price, customer_email')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', `${startDate}T00:00:00`)
    .lte('created_at_shopify', `${endDate}T23:59:59`)
    .is('cancelled_at', null)
    .not('financial_status', 'eq', 'voided');

  if (error || !data || data.length === 0) {
    console.warn('Could not fetch new customer data, defaulting to 0%', error);
    return 0;
  }

  // Determine returning customers: those with orders BEFORE the period
  const periodEmails = new Set(
    data.map(o => o.customer_email?.toLowerCase()).filter(Boolean)
  );

  const returningEmails = new Set<string>();
  if (periodEmails.size > 0) {
    const emailArray = Array.from(periodEmails);
    const batchSize = 200;
    for (let i = 0; i < emailArray.length; i += batchSize) {
      const batch = emailArray.slice(i, i + batchSize);
      const { data: priorOrders } = await supabase
        .from('shopify_orders')
        .select('customer_email')
        .eq('organization_id', orgId)
        .lt('created_at_shopify', `${startDate}T00:00:00`)
        .in('customer_email', batch)
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'voided')
        .limit(batch.length);
      if (priorOrders) {
        for (const o of priorOrders) {
          if (o.customer_email) returningEmails.add(o.customer_email.toLowerCase());
        }
      }
    }
  }

  let totalRevenue = 0;
  let newCustomerRevenue = 0;

  for (const order of data) {
    const price = Number(order.total_price) || 0;
    totalRevenue += price;
    const isReturning = order.customer_email && returningEmails.has(order.customer_email.toLowerCase());
    if (!isReturning) {
      newCustomerRevenue += price;
    }
  }

  return totalRevenue > 0 ? newCustomerRevenue / totalRevenue : 0;
}

function aggregateByAd(
  rows: any[],
  newCustomerPct: number,
  endDate: string
): AdPerformanceRow[] {
  const grouped = new Map<string, any[]>();

  for (const row of rows) {
    const key = row.ad_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const result: AdPerformanceRow[] = [];

  for (const [adId, adRows] of grouped) {
    // Sum numeric fields
    let spend = 0, impressions = 0, reach = 0, clicks = 0, linkClicks = 0;
    let purchases = 0, revenue = 0, addToCart = 0, initiateCheckout = 0, landingPageViews = 0;
    let videoThruplay = 0, videoP25 = 0, videoP50 = 0, videoP75 = 0, videoP95 = 0, videoP100 = 0;
    let hasVideo = false;
    const dailyData: { date: string; roas: number; spend: number }[] = [];

    // Sort rows by date for trend calculation
    const sorted = [...adRows].sort((a, b) => a.date.localeCompare(b.date));

    for (const r of sorted) {
      const rSpend = Number(r.spend) || 0;
      const rRevenue = Number(r.revenue) || 0;
      spend += rSpend;
      impressions += Number(r.impressions) || 0;
      reach += Number(r.reach) || 0;
      clicks += Number(r.clicks) || 0;
      linkClicks += Number(r.link_clicks) || 0;
      purchases += Number(r.purchases) || 0;
      revenue += rRevenue;
      addToCart += Number(r.add_to_cart) || 0;
      initiateCheckout += Number(r.initiate_checkout) || 0;
      landingPageViews += Number(r.landing_page_views) || 0;

      if (r.video_thruplay != null) {
        hasVideo = true;
        videoThruplay += Number(r.video_thruplay) || 0;
        videoP25 += Number(r.video_p25) || 0;
        videoP50 += Number(r.video_p50) || 0;
        videoP75 += Number(r.video_p75) || 0;
        videoP95 += Number(r.video_p95) || 0;
        videoP100 += Number(r.video_p100) || 0;
      }

      dailyData.push({
        date: r.date,
        roas: rSpend > 0 ? rRevenue / rSpend : 0,
        spend: rSpend,
      });
    }

    // Calculate rates
    const frequency = impressions > 0 && reach > 0 ? impressions / reach : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = purchases > 0 ? spend / purchases : 0;
    const estimatedNewRevenue = revenue * newCustomerPct;
    const amer = spend > 0 ? estimatedNewRevenue / spend : 0;
    const ncRoas = spend > 0 ? estimatedNewRevenue / spend : 0;
    const hookRate = hasVideo && impressions > 0 ? (videoThruplay / impressions) * 100 : null;
    const holdRate = hasVideo && videoThruplay > 0 ? (videoP75 / videoThruplay) * 100 : null;
    const lpConvRate = landingPageViews > 0 ? (purchases / landingPageViews) * 100 : null;
    const atcRate = landingPageViews > 0 ? (addToCart / landingPageViews) * 100 : null;
    const atcToPurchase = addToCart > 0 ? (purchases / addToCart) * 100 : null;
    const checkoutRate = landingPageViews > 0 ? (initiateCheckout / landingPageViews) * 100 : null;

    // Calculate trend: compare last 3 days ROAS vs previous 3 days
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (dailyData.length >= 4) {
      const mid = Math.floor(dailyData.length / 2);
      const firstHalf = dailyData.slice(0, mid);
      const secondHalf = dailyData.slice(mid);
      const avgFirst = firstHalf.reduce((s, d) => s + d.roas, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, d) => s + d.roas, 0) / secondHalf.length;
      const diff = avgSecond - avgFirst;
      if (diff > 0.15) trend = 'up';
      else if (diff < -0.15) trend = 'down';
    }

    const latest = sorted[sorted.length - 1];

    // Determine phase based on spend within the selected date range
    let phase: string;
    if (spend === 0) {
      phase = 'inactive';
    } else {
      // Find the most recent date with spend
      const daysWithSpend = dailyData.filter(d => d.spend > 0);
      const lastSpendDate = daysWithSpend.length > 0
        ? daysWithSpend[daysWithSpend.length - 1].date
        : null;

      if (!lastSpendDate) {
        phase = 'inactive';
      } else {
        // Check if last spend is within 3 days of the end of the selected range
        const endMs = new Date(endDate + 'T23:59:59').getTime();
        const lastSpendMs = new Date(lastSpendDate + 'T00:00:00').getTime();
        const daysSinceLastSpend = Math.floor((endMs - lastSpendMs) / (1000 * 60 * 60 * 24));

        if (daysSinceLastSpend <= 3) {
          phase = 'active';
        } else {
          // Ad had spend in the range but stopped >3 days before end
          if (roas >= 2.0) {
            phase = 'scaling';
          } else if (roas >= 1.0) {
            phase = 'mature';
          } else {
            phase = 'declining';
          }
        }
      }
    }

    result.push({
      ad_id: adId,
      ad_name: latest.ad_name || '',
      campaign_id: latest.campaign_id || '',
      campaign_name: latest.campaign_name || '',
      adset_id: latest.adset_id || '',
      adset_name: latest.adset_name || '',
      spend,
      impressions,
      reach,
      frequency,
      cpm,
      clicks,
      link_clicks: linkClicks,
      ctr,
      cpc,
      purchases,
      revenue,
      add_to_cart: addToCart,
      initiate_checkout: initiateCheckout,
      landing_page_views: landingPageViews,
      video_thruplay: hasVideo ? videoThruplay : null,
      video_p25: hasVideo ? videoP25 : null,
      video_p50: hasVideo ? videoP50 : null,
      video_p75: hasVideo ? videoP75 : null,
      video_p95: hasVideo ? videoP95 : null,
      video_p100: hasVideo ? videoP100 : null,
      video_avg_time: null, // avg doesn't sum well
      roas,
      cpa,
      new_customer_pct: newCustomerPct,
      estimated_new_revenue: estimatedNewRevenue,
      amer,
      nc_roas: ncRoas,
      hook_rate: hookRate,
      hold_rate: holdRate,
      lp_conv_rate: lpConvRate,
      atc_rate: atcRate,
      atc_to_purchase: atcToPurchase,
      checkout_rate: checkoutRate,
      trend,
      dailyData,
      phase,
    });
  }

  return result;
}

async function fetchAdPerformance(
  orgId: string,
  dateRange: DateRange
): Promise<AdPerformanceRow[]> {
  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr = format(dateRange.end, 'yyyy-MM-dd');

  // Paginate to fetch ALL rows (Supabase default limit is 1000)
  const pageSize = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ad_performance_daily')
      .select('*')
      .eq('organization_id', orgId)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching ad performance:', error);
      return [];
    }
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    from += pageSize;
    hasMore = data.length === pageSize;
  }

  if (allData.length === 0) return [];

  // Fetch new customer revenue percentage from Shopify data
  const newCustomerPct = await fetchNewCustomerPercentage(orgId, startStr, endStr);

  return aggregateByAd(allData, newCustomerPct, endStr);
}

export function useAdPerformance(
  currentRange: DateRange
): AdPerformanceResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: ads, isLoading } = useQuery({
    queryKey: [
      'ad-performance',
      orgId,
      format(currentRange.start, 'yyyy-MM-dd'),
      format(currentRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: () => fetchAdPerformance(orgId!, currentRange),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const syncAdPerformance = useCallback(
    async (startDate: string, endDate: string) => {
      if (!orgId) {
        toast.error('No hay organización seleccionada');
        return false;
      }

      setSyncing(true);

      try {
        const { data, error } = await supabase.functions.invoke(
          'sync-meta-ad-performance',
          {
            body: { organizationId: orgId, startDate, endDate },
          }
        );

        if (error) throw error;

        if (data.needsReconnect) {
          toast.error(
            data.error || 'Necesitas reconectar tu cuenta de Meta Ads'
          );
          return false;
        }

        if (data.success) {
          toast.success(
            `Ads sincronizados: ${data.syncedAds} registros de ${data.totalAds}`
          );
          queryClient.invalidateQueries({ queryKey: ['ad-performance'] });
          return true;
        } else {
          toast.error(data.error || 'Error al sincronizar ads');
          return false;
        }
      } catch (error: any) {
        console.error('Error syncing ad performance:', error);
        toast.error('Error al sincronizar rendimiento de ads');
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [orgId, queryClient]
  );

  return {
    ads: ads ?? [],
    isLoading,
    syncing,
    syncAdPerformance,
  };
}
