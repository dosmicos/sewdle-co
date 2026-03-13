import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format, subMonths, startOfMonth, endOfMonth, subDays } from 'date-fns';

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
  newCustomerCount: number;
  returningCustomerCount: number;
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
  const sixMonthsAgo = format(subMonths(now, 6), 'yyyy-MM-dd');
  const thirtyDaysAgo = subDays(now, 30);
  const sixMonthsBeforeThat = format(subMonths(thirtyDaysAgo, 6), 'yyyy-MM-dd');
  const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

  // Current active file: distinct customers in last 6 months
  const { data: currentData, error: currentError } = await supabase
    .from('shopify_orders')
    .select('customer_email')
    .eq('organization_id', orgId)
    .gte('created_at_shopify', sixMonthsAgo)
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
  const layers: MonthlyLayer[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd'T'23:59:59");
    const monthLabel = format(monthDate, 'yyyy-MM');

    const { data, error } = await supabase
      .from('shopify_orders')
      .select('total_price, customer_orders_count')
      .eq('organization_id', orgId)
      .gte('created_at_shopify', monthStart)
      .lte('created_at_shopify', monthEnd)
      .not('financial_status', 'eq', 'voided')
      .not('financial_status', 'eq', 'refunded');

    if (error) throw error;

    const orders = data ?? [];
    const newOrders = orders.filter(o => (o.customer_orders_count ?? 0) <= 1);
    const returningOrders = orders.filter(o => (o.customer_orders_count ?? 0) > 1);

    layers.push({
      month: monthLabel,
      newRevenue: newOrders.reduce((s, o) => s + (o.total_price ?? 0), 0),
      returningRevenue: returningOrders.reduce((s, o) => s + (o.total_price ?? 0), 0),
      newOrders: newOrders.length,
      returningOrders: returningOrders.length,
    });
  }

  return layers;
}

export function useCustomerHealth(
  newCustomerRevenue: number,
  returningCustomerRevenue: number,
  newCustomerOrders: number,
  totalOrders: number,
  adSpend: number
): { data: CustomerHealthData; isLoading: boolean } {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const activeFileQuery = useQuery({
    queryKey: ['customer-health', 'active-file', orgId],
    queryFn: () => fetchActiveFile(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 15, // 15 min — expensive query
  });

  const layersQuery = useQuery({
    queryKey: ['customer-health', 'layers', orgId],
    queryFn: () => fetchMonthlyLayers(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 15,
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

  const data: CustomerHealthData = {
    newCustomerRevenue,
    returningCustomerRevenue,
    newCustomerCount: newCustomerOrders,
    returningCustomerCount: returningOrders,
    newCustomerPct: totalRevenue > 0 ? (newCustomerRevenue / totalRevenue) * 100 : 0,
    returningCustomerPct: totalRevenue > 0 ? (returningCustomerRevenue / totalRevenue) * 100 : 0,
    ncpa: newCustomerOrders > 0 ? adSpend / newCustomerOrders : 0,
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
