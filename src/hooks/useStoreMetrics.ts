import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useStoreContext } from '@/contexts/StoreContext';
import { type DateRange } from './useFinanceDateRange';
import { format, eachDayOfInterval, startOfDay } from 'date-fns';

export interface StoreMetrics {
  totalSales: number;
  orders: number;
  returns: number;
  taxes: number;
  aov: number;
  discounts: number;
  newCustomerRevenue: number;
  returningCustomerRevenue: number;
  newCustomerOrders: number;
  // Unique-customer counts (dedup by email; guest-checkouts with no email
  // are excluded so the numbers can be compared to Shopify Analytics).
  newCustomerCount: number;
  returningCustomerCount: number;
  // % of unique customers in the period that had prior orders. Shopify-style.
  returningCustomerRate: number;
  unitsSold: number;
  totalShipping: number;
  saleTaxes: number;
  dailyData: { date: string; totalSales: number; orders: number }[];
}

export interface StoreMetricsResult {
  current: StoreMetrics;
  previous: StoreMetrics;
  changes: Record<string, number>;
  isLoading: boolean;
}

const emptyMetrics: StoreMetrics = {
  totalSales: 0,
  orders: 0,
  returns: 0,
  taxes: 0,
  aov: 0,
  discounts: 0,
  newCustomerRevenue: 0,
  returningCustomerRevenue: 0,
  newCustomerOrders: 0,
  newCustomerCount: 0,
  returningCustomerCount: 0,
  returningCustomerRate: 0,
  unitsSold: 0,
  totalShipping: 0,
  saleTaxes: 0,
  dailyData: [],
};

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchAllOrders(orgId: string, startStr: string, endStr: string, storeId?: string | null) {
  const pageSize = 1000;
  let allOrders: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let q = supabase
      .from('shopify_orders')
      .select('shopify_order_id, total_price, raw_data->current_total_price, total_tax, total_discounts, total_shipping, customer_id, customer_email, customer_orders_count, created_at_shopify, financial_status, cancelled_at')
      .eq('organization_id', orgId)
      .gte('created_at_shopify', startStr)
      .lte('created_at_shopify', endStr)
      .not('financial_status', 'eq', 'voided')
      .is('cancelled_at', null)
      .order('created_at_shopify', { ascending: true })
      .range(from, from + pageSize - 1);

    if (storeId) q = q.eq('store_id', storeId);

    const { data, error } = await q;

    if (error) throw error;
    if (!data || data.length === 0) break;

    allOrders = allOrders.concat(data);
    from += pageSize;
    hasMore = data.length === pageSize;
  }

  return allOrders;
}

async function fetchMetrics(
  orgId: string,
  range: DateRange,
  storeId?: string | null
): Promise<StoreMetrics> {
  // Use ISO strings to preserve timezone (fixes UTC-5 offset issue)
  const startStr = range.start.toISOString();
  const endStr = range.end.toISOString();

  // Fetch ALL orders with pagination (Supabase default limit is 1000)
  const orders = await fetchAllOrders(orgId, startStr, endStr, storeId);

  if (!orders || orders.length === 0) return emptyMetrics;

  // Fetch line items for units sold
  const orderIds = orders.map(o => o.shopify_order_id);

  let totalUnits = 0;
  // Batch line item queries — use large batches to minimize round trips
  const batchSize = 500;
  for (let i = 0; i < orderIds.length; i += batchSize) {
    const batch = orderIds.slice(i, i + batchSize);
    const { data: lineItems } = await supabase
      .from('shopify_order_line_items')
      .select('quantity')
      .eq('organization_id', orgId)
      .in('shopify_order_id', batch);

    if (lineItems) {
      totalUnits += lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);
    }
  }

  // Helper: get net revenue for an order (after refunds)
  // current_total_price comes from Shopify's raw_data and reflects actual revenue after refunds
  const getNetPrice = (o: any): number => {
    if (o.current_total_price != null) {
      const net = typeof o.current_total_price === 'string'
        ? parseFloat(o.current_total_price)
        : o.current_total_price;
      return isNaN(net) ? (o.total_price || 0) : net;
    }
    return o.total_price || 0;
  };

  // Exclude fully refunded orders from count (keep pending/COD — Shopify counts them)
  const validOrders = orders.filter(o => o.financial_status !== 'refunded');
  const refundedOrders = orders.filter(o => o.financial_status === 'refunded');

  // Use NET revenue (current_total_price) to match Shopify totals
  const totalSales = validOrders.reduce((sum, o) => sum + getNetPrice(o), 0);
  const totalOrders = validOrders.length;
  const returns = refundedOrders.length;
  // Supabase JS client returns `numeric` columns as strings on some setups,
  // which would make `sum + "0.00"` concatenate strings and yield NaN later.
  // Force numeric coercion to keep this robust regardless of column shape.
  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };
  const taxes = validOrders.reduce((sum, o) => sum + toNum(o.total_tax), 0);
  const discounts = validOrders.reduce((sum, o) => sum + toNum(o.total_discounts), 0);
  const shipping = validOrders.reduce((sum, o) => sum + toNum(o.total_shipping), 0);
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

  // New vs returning customer — determine by checking if the customer had
  // orders BEFORE this period. Match by Shopify's customer_id first (canonical
  // numeric ID, immune to email casing/typos/changes); fall back to email
  // when customer_id is null (guest checkouts).
  const customerKey = (o: { customer_id?: number | null; customer_email?: string | null }): string | null => {
    if (o.customer_id != null) return `id:${o.customer_id}`;
    if (o.customer_email) return `email:${o.customer_email.toLowerCase()}`;
    return null;
  };

  const periodCustomerIds = new Set<number>();
  const periodEmailsOnly = new Set<string>();
  for (const o of validOrders) {
    if (o.customer_id != null) {
      periodCustomerIds.add(o.customer_id);
    } else if (o.customer_email) {
      periodEmailsOnly.add(o.customer_email.toLowerCase());
    }
  }

  const returningKeys = new Set<string>();

  // Helper: page through a query until exhausted. PostgREST silently caps
  // any single response at max_rows (default 1000) regardless of .limit(),
  // so .range()-based pagination is the only correct way to fetch large
  // result sets.
  const PAGE_SIZE = 1000;
  async function paginate<T>(build: () => any): Promise<T[]> {
    const all: T[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...(data as T[]));
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return all;
  }

  // Priors keyed by customer_id (canonical Shopify identifier)
  if (periodCustomerIds.size > 0) {
    const idArray = Array.from(periodCustomerIds);
    const batchSizeIds = 200;
    for (let i = 0; i < idArray.length; i += batchSizeIds) {
      const batch = idArray.slice(i, i + batchSizeIds);
      const priorOrders = await paginate<{ customer_id: number | null }>(() => {
        let q = supabase
          .from('shopify_orders')
          .select('customer_id')
          .eq('organization_id', orgId)
          .lt('created_at_shopify', startStr)
          .in('customer_id', batch)
          .is('cancelled_at', null)
          .not('financial_status', 'eq', 'voided')
          .order('created_at_shopify', { ascending: true });
        if (storeId) q = q.eq('store_id', storeId);
        return q;
      });
      for (const o of priorOrders) {
        if (o.customer_id != null) returningKeys.add(`id:${o.customer_id}`);
      }
    }
  }

  // Priors keyed by email (guest checkouts only — orders with no customer_id)
  if (periodEmailsOnly.size > 0) {
    const emailArray = Array.from(periodEmailsOnly);
    const batchSizeEmails = 200;
    for (let i = 0; i < emailArray.length; i += batchSizeEmails) {
      const batch = emailArray.slice(i, i + batchSizeEmails);
      const priorOrders = await paginate<{ customer_email: string | null }>(() => {
        let q = supabase
          .from('shopify_orders')
          .select('customer_email')
          .eq('organization_id', orgId)
          .lt('created_at_shopify', startStr)
          .in('customer_email', batch)
          .is('customer_id', null)
          .is('cancelled_at', null)
          .not('financial_status', 'eq', 'voided')
          .order('created_at_shopify', { ascending: true });
        if (storeId) q = q.eq('store_id', storeId);
        return q;
      });
      for (const o of priorOrders) {
        if (o.customer_email) returningKeys.add(`email:${o.customer_email.toLowerCase()}`);
      }
    }
  }

  // Shopify-compatible "returning" definition: a customer is returning if
  // their LIFETIME order count is ≥ 2. That includes both customers with
  // prior-period orders (already in returningKeys above) AND customers
  // whose first lifetime order was in this period but who reordered within
  // the same period (no priors, but 2+ orders here).
  //
  // Without this second condition our rate underreports vs Shopify Analytics
  // because we miss the "first purchase + immediate reorder" cohort.
  const periodOrderCountByCustomer = new Map<string, number>();
  for (const o of validOrders) {
    const k = customerKey(o);
    if (k) periodOrderCountByCustomer.set(k, (periodOrderCountByCustomer.get(k) || 0) + 1);
  }
  for (const [k, count] of periodOrderCountByCustomer) {
    if (count >= 2) returningKeys.add(k);
  }

  const newOrders = validOrders.filter(o => {
    const k = customerKey(o);
    return !k || !returningKeys.has(k);
  });
  const returningOrders = validOrders.filter(o => {
    const k = customerKey(o);
    return k != null && returningKeys.has(k);
  });

  const newCustomerRevenue = newOrders.reduce((sum, o) => sum + getNetPrice(o), 0);
  const returningCustomerRevenue = returningOrders.reduce((sum, o) => sum + getNetPrice(o), 0);

  // Unique-customer counts (dedup by customer_id || email).
  // Matches Shopify Analytics's definition of a "customer".
  const newCustomerKeys = new Set<string>();
  for (const o of newOrders) {
    const k = customerKey(o);
    if (k) newCustomerKeys.add(k);
  }
  const returningCustomerKeys = new Set<string>();
  for (const o of returningOrders) {
    const k = customerKey(o);
    if (k) returningCustomerKeys.add(k);
  }
  const newCustomerCount = newCustomerKeys.size;
  const returningCustomerCount = returningCustomerKeys.size;
  const uniqueCustomers = newCustomerCount + returningCustomerCount;
  const returningCustomerRate = uniqueCustomers > 0
    ? (returningCustomerCount / uniqueCustomers) * 100
    : 0;

  // Daily breakdown for sparklines
  const days = eachDayOfInterval({ start: range.start, end: range.end });
  const dailyData = days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOrders = validOrders.filter(o => {
      const orderDate = format(new Date(o.created_at_shopify), 'yyyy-MM-dd');
      return orderDate === dayStr;
    });
    return {
      date: dayStr,
      totalSales: dayOrders.reduce((sum, o) => sum + getNetPrice(o), 0),
      orders: dayOrders.length,
    };
  });

  return {
    totalSales,
    orders: totalOrders,
    returns,
    taxes,
    aov,
    discounts,
    newCustomerRevenue,
    returningCustomerRevenue,
    newCustomerOrders: newOrders.length,
    newCustomerCount,
    returningCustomerCount,
    returningCustomerRate,
    unitsSold: totalUnits,
    totalShipping: shipping,
    saleTaxes: taxes,
    dailyData,
  };
}

export function useStoreMetrics(current: DateRange, previous: DateRange): StoreMetricsResult {
  const { currentOrganization } = useOrganization();
  const { activeStoreId } = useStoreContext();
  const orgId = currentOrganization?.id;

  const currentQuery = useQuery({
    queryKey: ['store-metrics', 'current', orgId, activeStoreId, format(current.start, 'yyyy-MM-dd'), format(current.end, 'yyyy-MM-dd')],
    queryFn: () => fetchMetrics(orgId!, current, activeStoreId),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30, // 30 min — expensive batch query
    refetchOnWindowFocus: false,
  });

  const previousQuery = useQuery({
    queryKey: ['store-metrics', 'previous', orgId, activeStoreId, format(previous.start, 'yyyy-MM-dd'), format(previous.end, 'yyyy-MM-dd')],
    queryFn: () => fetchMetrics(orgId!, previous, activeStoreId),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const cur = currentQuery.data || emptyMetrics;
  const prev = previousQuery.data || emptyMetrics;

  const changes: Record<string, number> = {
    totalSales: calcChange(cur.totalSales, prev.totalSales),
    orders: calcChange(cur.orders, prev.orders),
    returns: calcChange(cur.returns, prev.returns),
    taxes: calcChange(cur.taxes, prev.taxes),
    aov: calcChange(cur.aov, prev.aov),
    discounts: calcChange(cur.discounts, prev.discounts),
    newCustomerRevenue: calcChange(cur.newCustomerRevenue, prev.newCustomerRevenue),
    returningCustomerRevenue: calcChange(cur.returningCustomerRevenue, prev.returningCustomerRevenue),
    newCustomerOrders: calcChange(cur.newCustomerOrders, prev.newCustomerOrders),
    unitsSold: calcChange(cur.unitsSold, prev.unitsSold),
    totalShipping: calcChange(cur.totalShipping, prev.totalShipping),
    saleTaxes: calcChange(cur.saleTaxes, prev.saleTaxes),
  };

  return {
    current: cur,
    previous: prev,
    changes,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    error: currentQuery.error || previousQuery.error,
  };
}
