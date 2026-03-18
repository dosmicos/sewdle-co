import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
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
  unitsSold: 0,
  totalShipping: 0,
  saleTaxes: 0,
  dailyData: [],
};

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

async function fetchMetrics(
  orgId: string,
  range: DateRange
): Promise<StoreMetrics> {
  // Use ISO strings to preserve timezone (fixes UTC-5 offset issue)
  const startStr = range.start.toISOString();
  const endStr = range.end.toISOString();

  // Fetch orders in range — exclude voided, cancelled, and pending (unpaid) orders
  const { data: orders, error } = await supabase
    .from('shopify_orders')
    .select('shopify_order_id, total_price, total_tax, total_discounts, total_shipping, customer_email, customer_orders_count, created_at_shopify, financial_status, cancelled_at')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', startStr)
    .lte('created_at_shopify', endStr)
    .not('financial_status', 'eq', 'voided')
    .is('cancelled_at', null);

  if (error) throw error;
  if (!orders || orders.length === 0) return emptyMetrics;

  // Fetch line items for units sold
  const orderIds = orders.map(o => o.shopify_order_id);

  let totalUnits = 0;
  // Batch line item queries to avoid URL length limits
  const batchSize = 50;
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

  // Exclude fully refunded orders from revenue (keep pending/COD — Shopify counts them)
  const validOrders = orders.filter(o => o.financial_status !== 'refunded');
  const refundedOrders = orders.filter(o => o.financial_status === 'refunded');

  const totalSales = validOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const totalOrders = validOrders.length;
  const returns = refundedOrders.length;
  const taxes = validOrders.reduce((sum, o) => sum + (o.total_tax || 0), 0);
  const discounts = validOrders.reduce((sum, o) => sum + (o.total_discounts || 0), 0);
  const shipping = validOrders.reduce((sum, o) => sum + (o.total_shipping || 0), 0);
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;

  // New vs returning customer
  const newOrders = validOrders.filter(o => (o.customer_orders_count || 0) <= 1);
  const returningOrders = validOrders.filter(o => (o.customer_orders_count || 0) > 1);

  const newCustomerRevenue = newOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);
  const returningCustomerRevenue = returningOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

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
      totalSales: dayOrders.reduce((sum, o) => sum + (o.total_price || 0), 0),
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
    unitsSold: totalUnits,
    totalShipping: shipping,
    saleTaxes: taxes,
    dailyData,
  };
}

export function useStoreMetrics(current: DateRange, previous: DateRange): StoreMetricsResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const currentQuery = useQuery({
    queryKey: ['store-metrics', 'current', orgId, format(current.start, 'yyyy-MM-dd'), format(current.end, 'yyyy-MM-dd')],
    queryFn: () => fetchMetrics(orgId!, current),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30, // 30 min — expensive batch query
    refetchOnWindowFocus: false,
  });

  const previousQuery = useQuery({
    queryKey: ['store-metrics', 'previous', orgId, format(previous.start, 'yyyy-MM-dd'), format(previous.end, 'yyyy-MM-dd')],
    queryFn: () => fetchMetrics(orgId!, previous),
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
  };
}
