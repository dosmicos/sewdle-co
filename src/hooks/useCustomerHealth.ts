import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { subMonths, startOfMonth, endOfMonth, subDays, format } from 'date-fns';

export interface MonthlyLayer {
  month: string;
  newRevenue: number;
  returningRevenue: number;
  newOrders: number;
  returningOrders: number;
}

export interface CustomerHealthData {
  // Current period (passed in from storeMetrics)
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  // Unique customers (dedup by email, guest checkouts excluded) — matches Shopify
  newCustomerCount: number;
  returningCustomerCount: number;
  // % of unique customers in the period that had prior orders (Shopify-style).
  returningCustomerRate: number;
  // Revenue-weighted splits (independent of customer counts)
  newCustomerPct: number;
  returningCustomerPct: number;

  // Acquisition cost metrics
  ncpa: number;
  ncRoas: number;
  amer: number;

  // Active customer file
  activeCustomers: number;
  previousActiveCustomers: number;
  activeFileTrend: 'growing' | 'shrinking' | 'stable';
  activeFileChange: number;

  // Layer cake (last 6 months)
  monthlyLayers: MonthlyLayer[];
}

interface ActiveFileQueryResult {
  current: number;
  previous: number;
}

async function fetchActiveFile(orgId: string): Promise<ActiveFileQueryResult> {
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6).toISOString();
  const thirtyDaysAgo = subDays(now, 30);
  const sixMonthsBeforeThat = subMonths(thirtyDaysAgo, 6).toISOString();
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  // Current active file: distinct customers in last 6 months
  const { data: currentData, error: currentError } = await supabase
    .from('shopify_orders')
    .select('customer_email')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', sixMonthsAgo)
    .is('cancelled_at', null)
    .not('financial_status', 'eq', 'voided')
    .not('financial_status', 'eq', 'refunded');

  if (currentError) throw currentError;

  const currentUnique = new Set(
    (currentData ?? []).map(o => o.customer_email).filter(Boolean)
  ).size;

  // Previous active file: distinct customers 6 months prior to 30 days ago
  const { data: previousData, error: previousError } = await supabase
    .from('shopify_orders')
    .select('customer_email')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', sixMonthsBeforeThat)
    .lte('created_at_shopify', thirtyDaysAgoStr)
    .is('cancelled_at', null)
    .not('financial_status', 'eq', 'voided')
    .not('financial_status', 'eq', 'refunded');

  if (previousError) throw previousError;

  const previousUnique = new Set(
    (previousData ?? []).map(o => o.customer_email).filter(Boolean)
  ).size;

  return { current: currentUnique, previous: previousUnique };
}

async function fetchMonthlyLayers(orgId: string): Promise<MonthlyLayer[]> {
  const now = new Date();
  const sixMonthsAgo = startOfMonth(subMonths(now, 5)).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  // Note on net revenue: useStoreMetrics treats raw_data->current_total_price
  // (the post-refund value Shopify computes) as the source of truth, falling
  // back to total_price. We replicate that here so the Layer Cake matches
  // the rest of the dashboard.
  //
  // limit(50000): Supabase/PostgREST applies a 1000-row default cap. For
  // high-volume stores that silently truncated the result and produced a
  // chart that only rendered the most recent month (BUG: Layer Cake showed
  // just one column).
  const { data, error } = await supabase
    .from('shopify_orders')
    .select('total_price, raw_data->current_total_price, customer_id, customer_email, created_at_shopify')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', sixMonthsAgo)
    .lte('created_at_shopify', monthEnd)
    .is('cancelled_at', null)
    .not('financial_status', 'eq', 'voided')
    .not('financial_status', 'eq', 'refunded')
    .order('created_at_shopify', { ascending: true })
    .limit(50000);

  if (error) throw error;

  const getNetPrice = (o: any): number => {
    if (o?.current_total_price != null) {
      const net = typeof o.current_total_price === 'string'
        ? parseFloat(o.current_total_price)
        : o.current_total_price;
      if (!isNaN(net)) return net;
    }
    const fallback = typeof o?.total_price === 'string'
      ? parseFloat(o.total_price)
      : (o?.total_price ?? 0);
    return isNaN(fallback) ? 0 : fallback;
  };

  // Determine returning customers: those with orders BEFORE the 6-month window.
  // Match by Shopify customer_id first, fall back to email for guest checkouts.
  const customerKey = (o: { customer_id?: number | null; customer_email?: string | null }): string | null => {
    if (o.customer_id != null) return `id:${o.customer_id}`;
    if (o.customer_email) return `email:${o.customer_email.toLowerCase()}`;
    return null;
  };

  const periodIds = new Set<number>();
  const periodEmailsOnly = new Set<string>();
  for (const o of data ?? []) {
    if (o.customer_id != null) periodIds.add(o.customer_id);
    else if (o.customer_email) periodEmailsOnly.add(o.customer_email.toLowerCase());
  }

  const returningKeys = new Set<string>();

  if (periodIds.size > 0) {
    const idArray = Array.from(periodIds);
    const batchSize = 200;
    for (let i = 0; i < idArray.length; i += batchSize) {
      const batch = idArray.slice(i, i + batchSize);
      const { data: priorOrders } = await supabase
        .from('shopify_orders')
        .select('customer_id')
        .eq('organization_id', orgId)
        .lt('created_at_shopify', sixMonthsAgo)
        .in('customer_id', batch)
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'voided')
        .limit(50000);
      if (priorOrders) {
        for (const o of priorOrders) {
          if (o.customer_id != null) returningKeys.add(`id:${o.customer_id}`);
        }
      }
    }
  }

  if (periodEmailsOnly.size > 0) {
    const emailArray = Array.from(periodEmailsOnly);
    const batchSize = 200;
    for (let i = 0; i < emailArray.length; i += batchSize) {
      const batch = emailArray.slice(i, i + batchSize);
      const { data: priorOrders } = await supabase
        .from('shopify_orders')
        .select('customer_email')
        .eq('organization_id', orgId)
        .lt('created_at_shopify', sixMonthsAgo)
        .in('customer_email', batch)
        .is('customer_id', null)
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'voided')
        .limit(50000);
      if (priorOrders) {
        for (const o of priorOrders) {
          if (o.customer_email) returningKeys.add(`email:${o.customer_email.toLowerCase()}`);
        }
      }
    }
  }

  // Group by month client-side
  const monthMap = new Map<string, { newRev: number; retRev: number; newOrd: number; retOrd: number }>();
  for (const o of data ?? []) {
    const month = format(new Date(o.created_at_shopify), 'yyyy-MM');
    if (!monthMap.has(month)) monthMap.set(month, { newRev: 0, retRev: 0, newOrd: 0, retOrd: 0 });
    const m = monthMap.get(month)!;
    const k = customerKey(o);
    const isReturning = k != null && returningKeys.has(k);
    const netPrice = getNetPrice(o);
    if (isReturning) { m.retRev += netPrice; m.retOrd++; }
    else { m.newRev += netPrice; m.newOrd++; }
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      newRevenue: m.newRev,
      returningRevenue: m.retRev,
      newOrders: m.newOrd,
      returningOrders: m.retOrd,
    }));
}

export function useCustomerHealth(
  newCustomerRevenue: number,
  returningCustomerRevenue: number,
  newCustomerOrders: number,
  totalOrders: number,
  adSpend: number,
  // Unique-customer counts from useStoreMetrics. Older callers without these
  // fall back to order counts, but the dashboard should pass the unique numbers.
  newCustomerUniqueCount?: number,
  returningCustomerUniqueCount?: number,
  returningCustomerRateOverride?: number,
): { data: CustomerHealthData; isLoading: boolean } {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const activeFileQuery = useQuery({
    queryKey: ['customer-health', 'active-file', orgId],
    queryFn: () => fetchActiveFile(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60, // 1 hour — expensive query, data changes slowly
    refetchOnWindowFocus: false,
  });

  const layersQuery = useQuery({
    queryKey: ['customer-health', 'layers', orgId],
    queryFn: () => fetchMonthlyLayers(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchOnWindowFocus: false,
  });

  const activeFile = activeFileQuery.data ?? { current: 0, previous: 0 };
  const layers = layersQuery.data ?? [];

  const returningOrders = totalOrders - newCustomerOrders;
  const totalRevenue = newCustomerRevenue + returningCustomerRevenue;

  const activeFileChange = activeFile.previous > 0
    ? ((activeFile.current - activeFile.previous) / activeFile.previous) * 100
    : (activeFile.current > 0 ? 100 : 0);

  const activeFileTrend: 'growing' | 'shrinking' | 'stable' =
    activeFileChange > 2 ? 'growing' : activeFileChange < -2 ? 'shrinking' : 'stable';

  // Prefer the unique-customer counts when provided. Fall back to order counts
  // for callers that haven't migrated yet (preserves backward compatibility).
  const newCustomerCount = newCustomerUniqueCount ?? newCustomerOrders;
  const returningCustomerCount = returningCustomerUniqueCount ?? returningOrders;
  const totalUniqueWithEmail = newCustomerCount + returningCustomerCount;
  const returningCustomerRate = returningCustomerRateOverride !== undefined
    ? returningCustomerRateOverride
    : (totalUniqueWithEmail > 0 ? (returningCustomerCount / totalUniqueWithEmail) * 100 : 0);

  const data: CustomerHealthData = {
    newCustomerRevenue,
    returningCustomerRevenue,
    newCustomerCount,
    returningCustomerCount,
    returningCustomerRate,
    newCustomerPct: totalRevenue > 0 ? (newCustomerRevenue / totalRevenue) * 100 : 0,
    returningCustomerPct: totalRevenue > 0 ? (returningCustomerRevenue / totalRevenue) * 100 : 0,
    // NCPA = cost per unique new customer (matches Shopify's definition).
    ncpa: newCustomerCount > 0 ? adSpend / newCustomerCount : 0,
    ncRoas: adSpend > 0 ? newCustomerRevenue / adSpend : 0,
    amer: adSpend > 0 ? newCustomerRevenue / adSpend : 0,
    activeCustomers: activeFile.current,
    previousActiveCustomers: activeFile.previous,
    activeFileTrend,
    activeFileChange,
    monthlyLayers: layers,
  };

  return {
    data,
    isLoading: activeFileQuery.isLoading || layersQuery.isLoading,
  };
}
