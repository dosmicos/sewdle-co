import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { useState, useCallback, useMemo } from 'react';
import type { UgcCreator, UgcCreatorAd, UgcVideo } from '@/types/ugc';

interface SupabaseLooseError { message: string }

interface LooseQuery<T> extends PromiseLike<{ data: T | null; error: SupabaseLooseError | null }> {
  select(columns: string): LooseQuery<T>;
  eq(column: string, value: unknown): LooseQuery<T>;
  in(column: string, values: unknown[]): LooseQuery<T>;
  gte(column: string, value: unknown): LooseQuery<T>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): LooseQuery<T>;
  limit(count: number): LooseQuery<T>;
  maybeSingle(): PromiseLike<{ data: T | null; error: SupabaseLooseError | null }>;
}

interface LooseSupabaseClient {
  from<T>(relation: string): LooseQuery<T>;
  rpc<T>(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: T | null; error: SupabaseLooseError | null }>;
}

const looseSupabase = supabase as unknown as LooseSupabaseClient;

interface CreatorTagRow { id: string; name: string; color?: string | null }
interface TagAssignmentRow { creator_id: string; tag_id: string }
interface DiscountLinkRow {
  id: string;
  creator_id: string;
  redirect_token: string | null;
  discount_value: number | string | null;
  commission_rate: number | string | null;
  total_orders: number | string | null;
  total_revenue: number | string | null;
  total_commission: number | string | null;
  total_paid_out: number | string | null;
  is_active: boolean;
  updated_at: string | null;
}
interface AttributedOrderRow {
  id: string;
  creator_id: string;
  discount_link_id: string;
  order_total: number | string | null;
  discount_amount: number | string | null;
  commission_amount: number | string | null;
  order_date: string;
}
interface LinkClickRow { id: string; creator_id: string; discount_link_id: string; clicked_at: string }

export interface UgcAffiliateMetrics {
  hasActiveLink: boolean;
  linkId: string | null;
  redirectToken: string | null;
  discountValue: number | null;
  commissionRate: number | null;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  totalPaidOut: number;
  pendingBalance: number;
  weekOrders: number;
  weekRevenue: number;
  weekCommission: number;
  weekClicks: number;
  monthOrders: number;
  monthRevenue: number;
  monthCommission: number;
  monthClicks: number;
  weekContentPieces: number;
  monthContentPieces: number;
  lastOrderDate: string | null;
}

export interface UgcCreatorWithAffiliate extends UgcCreator {
  tags: string[];
  isCmd: boolean;
  affiliate: UgcAffiliateMetrics;
}

export interface UgcAffiliateMonthlyGoal {
  id?: string;
  organization_id?: string;
  month_start: string;
  revenue_goal: number;
  stretch_revenue_goal: number;
  orders_goal: number;
  converting_creators_goal: number;
  active_creators_goal: number;
  weekly_active_creators_goal: number;
  content_pieces_goal: number;
  active_links_goal: number;
  notes?: string | null;
}

const numberValue = (value: unknown) => Number(value ?? 0) || 0;

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const getPeriodStarts = () => {
  // Browser/client time is fine for dashboard display; SQL report RPC uses America/Bogota exactly.
  const now = new Date();
  return {
    weekStart: startOfWeek(now),
    monthStart: startOfMonth(now),
  };
};

const isInPeriod = (timestamp: string | null | undefined, periodStart: Date) => {
  if (!timestamp) return false;
  return new Date(timestamp) >= periodStart;
};

const defaultAffiliateMetrics = (): UgcAffiliateMetrics => ({
  hasActiveLink: false,
  linkId: null,
  redirectToken: null,
  discountValue: null,
  commissionRate: null,
  totalOrders: 0,
  totalRevenue: 0,
  totalCommission: 0,
  totalPaidOut: 0,
  pendingBalance: 0,
  weekOrders: 0,
  weekRevenue: 0,
  weekCommission: 0,
  weekClicks: 0,
  monthOrders: 0,
  monthRevenue: 0,
  monthCommission: 0,
  monthClicks: 0,
  weekContentPieces: 0,
  monthContentPieces: 0,
  lastOrderDate: null,
});

export function useUgcPerformance() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;
  const [computing, setComputing] = useState(false);

  const periods = useMemo(getPeriodStarts, []);

  // Fetch all creators: affiliate program needs CMD moms even if they do not have ad-score data yet.
  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ['ugc-performance-creators', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creators')
        .select('*')
        .eq('organization_id', orgId)
        .order('overall_score', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as UgcCreator[];
    },
    enabled: !!orgId,
  });

  // Fetch all creator ads
  const { data: creatorAds = [], isLoading: adsLoading } = useQuery({
    queryKey: ['ugc-creator-ads', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_ads')
        .select('*')
        .eq('organization_id', orgId)
        .order('roas', { ascending: false });
      if (error) throw error;
      return (data || []) as UgcCreatorAd[];
    },
    enabled: !!orgId,
  });

  const { data: creatorTags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['ugc-affiliate-tags', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_tags')
        .select('id, name, color')
        .eq('organization_id', orgId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: tagAssignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['ugc-affiliate-tag-assignments', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const tagIds = creatorTags.map((tag) => tag.id);
      if (tagIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ugc_creator_tag_assignments')
        .select('creator_id, tag_id')
        .in('tag_id', tagIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && creatorTags.length > 0,
  });

  const { data: discountLinks = [], isLoading: linksLoading } = useQuery({
    queryKey: ['ugc-affiliate-discount-links', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await looseSupabase
        .from<DiscountLinkRow[]>('ugc_discount_links')
        .select('id, creator_id, redirect_token, discount_value, commission_rate, total_orders, total_revenue, total_commission, total_paid_out, is_active, updated_at')
        .eq('organization_id', orgId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: attributedOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['ugc-affiliate-attributed-orders', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await looseSupabase
        .from<AttributedOrderRow[]>('ugc_attributed_orders')
        .select('id, creator_id, discount_link_id, order_total, discount_amount, commission_amount, order_date')
        .eq('organization_id', orgId)
        .order('order_date', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: linkClicks = [], isLoading: clicksLoading } = useQuery({
    queryKey: ['ugc-affiliate-link-clicks', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await looseSupabase
        .from<LinkClickRow[]>('ugc_link_clicks')
        .select('id, creator_id, discount_link_id, clicked_at')
        .eq('organization_id', orgId)
        .gte('clicked_at', periods.monthStart.toISOString())
        .order('clicked_at', { ascending: false })
        .limit(10000);
      if (error) {
        // Migration may not be applied yet; keep the dashboard usable.
        console.warn('ugc_link_clicks not available yet:', error.message);
        return [];
      }
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: ugcVideos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['ugc-affiliate-videos', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_videos')
        .select('id, creator_id, created_at, published_date, published_organic, published_ads, views, likes, comments')
        .eq('organization_id', orgId)
        .gte('created_at', periods.monthStart.toISOString())
        .limit(10000);
      if (error) throw error;
      return (data || []) as Partial<UgcVideo>[];
    },
    enabled: !!orgId,
  });

  const { data: monthlyGoal = null, isLoading: goalsLoading } = useQuery({
    queryKey: ['ugc-affiliate-monthly-goal', orgId, periods.monthStart.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await looseSupabase
        .from<UgcAffiliateMonthlyGoal>('ugc_affiliate_monthly_goals')
        .select('*')
        .eq('organization_id', orgId)
        .eq('month_start', periods.monthStart.toISOString().slice(0, 10))
        .maybeSingle();
      if (error) {
        console.warn('ugc_affiliate_monthly_goals not available yet:', error.message);
        return null;
      }
      return data as UgcAffiliateMonthlyGoal | null;
    },
    enabled: !!orgId,
  });

  const { data: weeklyReport = null, isLoading: reportLoading } = useQuery({
    queryKey: ['ugc-affiliate-weekly-report', orgId, periods.weekStart.toISOString()],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await looseSupabase.rpc<unknown>('get_ugc_affiliate_weekly_report', {
        p_org_id: orgId,
        p_week_start: periods.weekStart.toISOString().slice(0, 10),
        p_tag_name: 'CMD',
        p_month_start: periods.monthStart.toISOString().slice(0, 10),
      });
      if (error) {
        console.warn('get_ugc_affiliate_weekly_report not available yet:', error.message);
        return null;
      }
      return data;
    },
    enabled: !!orgId,
  });

  const tagById = new Map(creatorTags.map((tag) => [tag.id, tag.name]));
  const tagsByCreator = new Map<string, string[]>();
  for (const assignment of tagAssignments) {
    const tagName = tagById.get(assignment.tag_id);
    if (!tagName) continue;
    if (!tagsByCreator.has(assignment.creator_id)) tagsByCreator.set(assignment.creator_id, []);
    tagsByCreator.get(assignment.creator_id)!.push(String(tagName));
  }

  const activeLinkByCreator = new Map<string, DiscountLinkRow>();
  for (const link of discountLinks) {
    if (!link.is_active) continue;
    const current = activeLinkByCreator.get(link.creator_id);
    if (!current || new Date(link.updated_at) > new Date(current.updated_at)) {
      activeLinkByCreator.set(link.creator_id, link);
    }
  }

  const affiliateCreators: UgcCreatorWithAffiliate[] = creators.map((creator) => {
    const metrics = defaultAffiliateMetrics();
    const link = activeLinkByCreator.get(creator.id);
    if (link) {
      metrics.hasActiveLink = true;
      metrics.linkId = link.id;
      metrics.redirectToken = link.redirect_token;
      metrics.discountValue = numberValue(link.discount_value);
      metrics.commissionRate = numberValue(link.commission_rate);
      metrics.totalOrders = numberValue(link.total_orders);
      metrics.totalRevenue = numberValue(link.total_revenue);
      metrics.totalCommission = numberValue(link.total_commission);
      metrics.totalPaidOut = numberValue(link.total_paid_out);
      metrics.pendingBalance = Math.max(metrics.totalCommission - metrics.totalPaidOut, 0);
    }

    for (const order of attributedOrders) {
      if (order.creator_id !== creator.id) continue;
      const orderTotal = numberValue(order.order_total);
      const commission = numberValue(order.commission_amount);
      if (!metrics.lastOrderDate || new Date(order.order_date) > new Date(metrics.lastOrderDate)) {
        metrics.lastOrderDate = order.order_date;
      }
      if (isInPeriod(order.order_date, periods.weekStart)) {
        metrics.weekOrders += 1;
        metrics.weekRevenue += orderTotal;
        metrics.weekCommission += commission;
      }
      if (isInPeriod(order.order_date, periods.monthStart)) {
        metrics.monthOrders += 1;
        metrics.monthRevenue += orderTotal;
        metrics.monthCommission += commission;
      }
    }

    for (const click of linkClicks) {
      if (click.creator_id !== creator.id) continue;
      if (isInPeriod(click.clicked_at, periods.weekStart)) metrics.weekClicks += 1;
      if (isInPeriod(click.clicked_at, periods.monthStart)) metrics.monthClicks += 1;
    }

    for (const video of ugcVideos) {
      if (video.creator_id !== creator.id) continue;
      const date = video.published_date || video.created_at;
      if (isInPeriod(date, periods.weekStart)) metrics.weekContentPieces += 1;
      if (isInPeriod(date, periods.monthStart)) metrics.monthContentPieces += 1;
    }

    const tags = tagsByCreator.get(creator.id) || [];
    return {
      ...creator,
      tags,
      isCmd: tags.some((tag) => tag.toLowerCase() === 'cmd'),
      affiliate: metrics,
    };
  });

  // Build map: creator_id → ads[]
  const creatorAdsMap = new Map<string, UgcCreatorAd[]>();
  for (const ad of creatorAds) {
    if (!creatorAdsMap.has(ad.creator_id)) creatorAdsMap.set(ad.creator_id, []);
    creatorAdsMap.get(ad.creator_id)!.push(ad);
  }

  const affiliateSummary = useMemo(() => {
    const cmdCreators = affiliateCreators.filter((creator) => creator.isCmd);
    const activeLinkCreators = cmdCreators.filter((creator) => creator.affiliate.hasActiveLink);
    const weekActiveCreators = cmdCreators.filter((creator) =>
      creator.affiliate.weekOrders > 0 || creator.affiliate.weekClicks > 0 || creator.affiliate.weekContentPieces > 0
    );
    const monthActiveCreators = cmdCreators.filter((creator) =>
      creator.affiliate.monthOrders > 0 || creator.affiliate.monthClicks > 0 || creator.affiliate.monthContentPieces > 0
    );

    return {
      totalCreators: affiliateCreators.length,
      cmdCreators: cmdCreators.length,
      activeLinks: activeLinkCreators.length,
      linkActivationRate: cmdCreators.length > 0 ? (activeLinkCreators.length / cmdCreators.length) * 100 : 0,
      weekOrders: cmdCreators.reduce((sum, c) => sum + c.affiliate.weekOrders, 0),
      weekRevenue: cmdCreators.reduce((sum, c) => sum + c.affiliate.weekRevenue, 0),
      weekCommission: cmdCreators.reduce((sum, c) => sum + c.affiliate.weekCommission, 0),
      weekClicks: cmdCreators.reduce((sum, c) => sum + c.affiliate.weekClicks, 0),
      weekContentPieces: cmdCreators.reduce((sum, c) => sum + c.affiliate.weekContentPieces, 0),
      weekActiveCreators: weekActiveCreators.length,
      monthOrders: cmdCreators.reduce((sum, c) => sum + c.affiliate.monthOrders, 0),
      monthRevenue: cmdCreators.reduce((sum, c) => sum + c.affiliate.monthRevenue, 0),
      monthCommission: cmdCreators.reduce((sum, c) => sum + c.affiliate.monthCommission, 0),
      monthClicks: cmdCreators.reduce((sum, c) => sum + c.affiliate.monthClicks, 0),
      monthContentPieces: cmdCreators.reduce((sum, c) => sum + c.affiliate.monthContentPieces, 0),
      monthActiveCreators: monthActiveCreators.length,
      pendingBalance: cmdCreators.reduce((sum, c) => sum + c.affiliate.pendingBalance, 0),
      convertingCreatorsMonth: cmdCreators.filter((c) => c.affiliate.monthOrders > 0).length,
    };
  }, [affiliateCreators]);

  const computeUgcScores = useCallback(async () => {
    if (!orgId) return false;
    setComputing(true);
    try {
      // Step 1: Sync creative data from Meta to detect UGC handles
      toast.info('Sincronizando creativos de Meta...');
      const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-meta-ad-creative', {
        body: { organizationId: orgId, quickSync: true },
      });
      if (syncError) {
        console.error('Error syncing creatives:', syncError);
        toast.error(`Error sincronizando creativos: ${syncError.message}`);
      } else if (syncData?.error) {
        toast.error(`Sync Meta: ${syncData.error}`);
      } else {
        const synced = syncData?.creativesSync?.synced ?? 0;
        const total = syncData?.creativesSync?.total ?? 0;
        toast.success(`Creativos sincronizados: ${synced} de ${total} ads`);
      }

      // Step 2: Compute UGC scores with the updated data
      toast.info('Calculando scores...');
      const { data, error } = await supabase.functions.invoke('compute-ugc-scores', {
        body: { organizationId: orgId },
      });
      if (error) throw error;
      const result = data as { success: boolean; creatorsScored: number; adsLinked: number; autoCreated: number; totalHandles?: number; errors?: string[] };
      toast.success(
        `Scores computados: ${result.creatorsScored} creadoras, ${result.adsLinked} ads vinculados` +
          (result.autoCreated > 0 ? `, ${result.autoCreated} nuevas` : '')
      );
      if (result.errors && result.errors.length > 0) {
        toast.warning(`${result.errors.length} errores: ${result.errors.slice(0, 3).join('; ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ugc-performance-creators'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creator-ads'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-creators'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-affiliate-discount-links'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-affiliate-attributed-orders'] });
      queryClient.invalidateQueries({ queryKey: ['ugc-affiliate-link-clicks'] });
      return true;
    } catch (err) {
      toast.error(`Error computando scores: ${(err as Error).message}`);
      return false;
    } finally {
      setComputing(false);
    }
  }, [orgId, queryClient]);

  return {
    creators: affiliateCreators,
    creatorAds,
    creatorAdsMap,
    affiliateSummary,
    monthlyGoal,
    weeklyReport,
    isLoading:
      creatorsLoading || adsLoading || tagsLoading || assignmentsLoading || linksLoading || ordersLoading ||
      clicksLoading || videosLoading || goalsLoading || reportLoading,
    computing,
    computeUgcScores,
  };
}

export function useUgcCreatorDetail(creatorId: string | null) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  // Fetch this creator's ads
  const { data: ads = [], isLoading: adsLoading } = useQuery({
    queryKey: ['ugc-creator-detail-ads', creatorId],
    queryFn: async () => {
      if (!creatorId || !orgId) return [];
      const { data, error } = await supabase
        .from('ugc_creator_ads')
        .select('*')
        .eq('organization_id', orgId)
        .eq('creator_id', creatorId)
        .order('roas', { ascending: false });
      if (error) throw error;
      return (data || []) as UgcCreatorAd[];
    },
    enabled: !!creatorId && !!orgId,
  });

  // Fetch weekly ROAS trend from ad_performance_daily
  const adIds = ads.map((a) => a.ad_id);
  const { data: weeklyRoas = [], isLoading: roasLoading } = useQuery({
    queryKey: ['ugc-creator-weekly-roas', creatorId, adIds.join(',')],
    queryFn: async () => {
      if (!orgId || adIds.length === 0) return [];
      const { data, error } = await supabase
        .from('ad_performance_daily')
        .select('date, spend, revenue')
        .eq('organization_id', orgId)
        .in('ad_id', adIds)
        .order('date', { ascending: true });
      if (error) throw error;

      // Group by week (Monday start)
      const weekMap = new Map<string, { spend: number; revenue: number }>();
      for (const row of data || []) {
        const d = new Date(row.date);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const weekKey = monday.toISOString().split('T')[0];
        const curr = weekMap.get(weekKey) || { spend: 0, revenue: 0 };
        weekMap.set(weekKey, {
          spend: curr.spend + (Number(row.spend) || 0),
          revenue: curr.revenue + (Number(row.revenue) || 0),
        });
      }

      return Array.from(weekMap.entries())
        .map(([week, data]) => ({
          week,
          roas: data.spend > 0 ? Math.round((data.revenue / data.spend) * 100) / 100 : 0,
          spend: data.spend,
          revenue: data.revenue,
        }))
        .sort((a, b) => a.week.localeCompare(b.week));
    },
    enabled: !!creatorId && !!orgId && adIds.length > 0,
  });

  return {
    ads,
    weeklyRoas,
    isLoading: adsLoading || roasLoading,
  };
}
