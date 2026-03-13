import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useMemo } from 'react';
import { format, eachDayOfInterval } from 'date-fns';

export interface DailyActivity {
  date: string;
  // Revenue (from shopify_orders)
  revenue: number;
  orders: number;
  // Ads (from ad_performance_daily)
  activeAds: number;
  adSpend: number;
  // Creatives (from ad_creative_content)
  newCreatives: number;
  // UGC (from ugc_videos)
  ugcVideos: number;
  // Marketing events (from marketing_events)
  marketingEvents: number;
  // Messages (from messaging_messages)
  messagesSent: number;
  // Total activity count (sum of all action counts, excluding revenue)
  totalActions: number;
}

export interface ActivitySummary {
  totalRevenue: number;
  totalOrders: number;
  totalActiveAds: number;
  totalNewCreatives: number;
  totalUgcVideos: number;
  totalMarketingEvents: number;
  totalMessagesSent: number;
  totalActions: number;
  // Correlation between daily actions and revenue
  correlation: number;
}

export interface MarketingActivityResult {
  dailyData: DailyActivity[];
  summary: ActivitySummary;
  isLoading: boolean;
}

/**
 * Computes Pearson correlation coefficient between two arrays.
 * Returns value between -1 and 1.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function useMarketingActivity(
  startDate: Date,
  endDate: Date
): MarketingActivityResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  // 1. Daily revenue & orders from shopify_orders
  const revenueQuery = useQuery({
    queryKey: ['mkt-activity-revenue', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_orders')
        .select('created_at_shopify, total_price')
        .eq('organization_id', orgId!)
        .gte('created_at_shopify', startDate.toISOString())
        .lte('created_at_shopify', endDate.toISOString())
        .not('financial_status', 'eq', 'voided')
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'refunded');

      if (error) throw error;

      // Aggregate by date
      const byDate = new Map<string, { revenue: number; orders: number }>();
      for (const order of data || []) {
        const d = format(new Date(order.created_at_shopify), 'yyyy-MM-dd');
        const existing = byDate.get(d) || { revenue: 0, orders: 0 };
        existing.revenue += Number(order.total_price) || 0;
        existing.orders += 1;
        byDate.set(d, existing);
      }
      return byDate;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // 2. Active ads from ad_performance_daily (count distinct ad_id per date)
  const adsQuery = useQuery({
    queryKey: ['mkt-activity-ads', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_performance_daily')
        .select('date, ad_id, spend')
        .eq('organization_id', orgId!)
        .gte('date', startStr)
        .lte('date', endStr);

      if (error) throw error;

      // Count distinct ads and total spend per date
      const byDate = new Map<string, { ads: Set<string>; spend: number }>();
      for (const row of data || []) {
        const existing = byDate.get(row.date) || {
          ads: new Set<string>(),
          spend: 0,
        };
        existing.ads.add(row.ad_id);
        existing.spend += Number(row.spend) || 0;
        byDate.set(row.date, existing);
      }

      // Convert sets to counts
      const result = new Map<
        string,
        { activeAds: number; adSpend: number }
      >();
      for (const [date, val] of byDate) {
        result.set(date, { activeAds: val.ads.size, adSpend: val.spend });
      }
      return result;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  // 3. New creatives from ad_creative_content (by first_synced_at)
  const creativesQuery = useQuery({
    queryKey: ['mkt-activity-creatives', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_creative_content')
        .select('first_synced_at')
        .eq('organization_id', orgId!)
        .gte('first_synced_at', startDate.toISOString())
        .lte('first_synced_at', endDate.toISOString());

      if (error) throw error;

      const byDate = new Map<string, number>();
      for (const row of data || []) {
        if (!row.first_synced_at) continue;
        const d = format(new Date(row.first_synced_at), 'yyyy-MM-dd');
        byDate.set(d, (byDate.get(d) || 0) + 1);
      }
      return byDate;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  // 4. UGC videos uploaded (by created_at or published_date)
  const ugcQuery = useQuery({
    queryKey: ['mkt-activity-ugc', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ugc_videos')
        .select('created_at, published_date')
        .eq('organization_id', orgId!)
        .or(
          `created_at.gte.${startDate.toISOString()},published_date.gte.${startStr}`
        )
        .or(
          `created_at.lte.${endDate.toISOString()},published_date.lte.${endStr}`
        );

      if (error) throw error;

      // Use published_date if available, otherwise created_at
      const byDate = new Map<string, number>();
      for (const row of data || []) {
        const d = row.published_date || format(new Date(row.created_at), 'yyyy-MM-dd');
        if (d >= startStr && d <= endStr) {
          byDate.set(d, (byDate.get(d) || 0) + 1);
        }
      }
      return byDate;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  // 5. Marketing events (by event_date)
  const eventsQuery = useQuery({
    queryKey: ['mkt-activity-events', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_events')
        .select('event_date')
        .eq('organization_id', orgId!)
        .gte('event_date', startStr)
        .lte('event_date', endStr);

      if (error) throw error;

      const byDate = new Map<string, number>();
      for (const row of data || []) {
        byDate.set(row.event_date, (byDate.get(row.event_date) || 0) + 1);
      }
      return byDate;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // 6. Messages sent (outbound from messaging_messages)
  const messagesQuery = useQuery({
    queryKey: ['mkt-activity-messages', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messaging_messages')
        .select('sent_at')
        .eq('direction', 'outbound')
        .gte('sent_at', startDate.toISOString())
        .lte('sent_at', endDate.toISOString())
        .limit(5000);

      if (error) throw error;

      const byDate = new Map<string, number>();
      for (const row of data || []) {
        if (!row.sent_at) continue;
        const d = format(new Date(row.sent_at), 'yyyy-MM-dd');
        byDate.set(d, (byDate.get(d) || 0) + 1);
      }
      return byDate;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  // Merge all data into daily breakdown
  const { dailyData, summary } = useMemo(() => {
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });
    const revenueMap = revenueQuery.data || new Map();
    const adsMap = adsQuery.data || new Map();
    const creativesMap = creativesQuery.data || new Map();
    const ugcMap = ugcQuery.data || new Map();
    const eventsMap = eventsQuery.data || new Map();
    const messagesMap = messagesQuery.data || new Map();

    let totalRevenue = 0;
    let totalOrders = 0;
    let totalActiveAds = 0;
    let totalNewCreatives = 0;
    let totalUgcVideos = 0;
    let totalMarketingEvents = 0;
    let totalMessagesSent = 0;
    let totalActions = 0;

    const daily: DailyActivity[] = allDays.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const rev = revenueMap.get(dateKey) || { revenue: 0, orders: 0 };
      const ads = adsMap.get(dateKey) || { activeAds: 0, adSpend: 0 };
      const creatives = creativesMap.get(dateKey) || 0;
      const ugc = ugcMap.get(dateKey) || 0;
      const events = eventsMap.get(dateKey) || 0;
      const messages = messagesMap.get(dateKey) || 0;

      const dayActions = ads.activeAds + creatives + ugc + events + messages;

      totalRevenue += rev.revenue;
      totalOrders += rev.orders;
      totalActiveAds += ads.activeAds;
      totalNewCreatives += creatives;
      totalUgcVideos += ugc;
      totalMarketingEvents += events;
      totalMessagesSent += messages;
      totalActions += dayActions;

      return {
        date: dateKey,
        revenue: rev.revenue,
        orders: rev.orders,
        activeAds: ads.activeAds,
        adSpend: ads.adSpend,
        newCreatives: creatives,
        ugcVideos: ugc,
        marketingEvents: events,
        messagesSent: messages,
        totalActions: dayActions,
      };
    });

    // Compute correlation between total actions and revenue
    const actions = daily.map((d) => d.totalActions);
    const revenues = daily.map((d) => d.revenue);
    const correlation = pearsonCorrelation(actions, revenues);

    return {
      dailyData: daily,
      summary: {
        totalRevenue,
        totalOrders,
        totalActiveAds,
        totalNewCreatives,
        totalUgcVideos,
        totalMarketingEvents,
        totalMessagesSent,
        totalActions,
        correlation,
      },
    };
  }, [
    startDate,
    endDate,
    revenueQuery.data,
    adsQuery.data,
    creativesQuery.data,
    ugcQuery.data,
    eventsQuery.data,
    messagesQuery.data,
  ]);

  const isLoading =
    revenueQuery.isLoading ||
    adsQuery.isLoading ||
    creativesQuery.isLoading ||
    ugcQuery.isLoading ||
    eventsQuery.isLoading ||
    messagesQuery.isLoading;

  return { dailyData, summary, isLoading };
}
