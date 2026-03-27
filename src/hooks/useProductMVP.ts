import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format, subDays } from 'date-fns';

export type ProductClassification =
  | 'champion'
  | 'growth_driver'
  | 'hidden_gem'
  | 'underperformer'
  | 'unclassified';

export interface ProductMVP {
  product_name: string;
  classification: ProductClassification;
  total_spend: number;
  total_revenue: number;
  total_purchases: number;
  roas: number;
  share_of_spend: number;
  share_of_revenue: number;
  ad_count: number;
  recommendation: string;
}

const RECOMMENDATIONS: Record<ProductClassification, string> = {
  champion: 'Proteger. Escalar si hay inventario.',
  growth_driver: 'Aumentar inversión +30%. Monitorear ROAS semanal.',
  hidden_gem: 'Oportunidad: aumentar spend para descubrir potencial.',
  underperformer: 'Pausar o liquidar. Reasignar budget a Champions.',
  unclassified: 'Monitorear. Datos insuficientes para clasificar.',
};

interface RawRow {
  ad_id: string;
  date: string;
  spend: number;
  revenue: number;
  purchases: number;
  ad_tags: { product: string | null; product_name: string | null } | null;
}

async function fetchProductMVPData(orgId: string): Promise<ProductMVP[]> {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const fifteenDaysAgo = subDays(now, 15);
  const startStr = format(thirtyDaysAgo, 'yyyy-MM-dd');
  const midStr = format(fifteenDaysAgo, 'yyyy-MM-dd');
  const endStr = format(now, 'yyyy-MM-dd');

  // Fetch ad_performance_daily joined with ad_tags for last 30 days
  const { data, error } = await supabase
    .from('ad_performance_daily')
    .select('ad_id, date, spend, revenue, purchases, ad_tags!inner(product, product_name)')
    .eq('organization_id', orgId)
    .gte('date', startStr)
    .lte('date', endStr);

  if (error) {
    console.error('Error fetching product MVP data:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group by product
  const productMap = new Map<
    string,
    {
      spend: number;
      revenue: number;
      purchases: number;
      adIds: Set<string>;
      // For trend: first half (days 1-15) and second half (days 16-30)
      firstHalfSpend: number;
      firstHalfRevenue: number;
      secondHalfSpend: number;
      secondHalfRevenue: number;
    }
  >();

  for (const row of data as unknown as RawRow[]) {
    const tags = row.ad_tags;
    const productName = tags?.product_name || tags?.product || 'Sin Producto';
    const normalizedName = productName.trim() || 'Sin Producto';

    if (!productMap.has(normalizedName)) {
      productMap.set(normalizedName, {
        spend: 0,
        revenue: 0,
        purchases: 0,
        adIds: new Set(),
        firstHalfSpend: 0,
        firstHalfRevenue: 0,
        secondHalfSpend: 0,
        secondHalfRevenue: 0,
      });
    }

    const entry = productMap.get(normalizedName)!;
    const spend = Number(row.spend) || 0;
    const revenue = Number(row.revenue) || 0;
    const purchases = Number(row.purchases) || 0;

    entry.spend += spend;
    entry.revenue += revenue;
    entry.purchases += purchases;
    entry.adIds.add(row.ad_id);

    // Split into halves for trend detection
    if (row.date < midStr) {
      entry.firstHalfSpend += spend;
      entry.firstHalfRevenue += revenue;
    } else {
      entry.secondHalfSpend += spend;
      entry.secondHalfRevenue += revenue;
    }
  }

  // Calculate totals for share calculations
  let totalSpendAll = 0;
  let totalRevenueAll = 0;
  for (const entry of productMap.values()) {
    totalSpendAll += entry.spend;
    totalRevenueAll += entry.revenue;
  }

  // Build and classify products
  const products: ProductMVP[] = [];

  for (const [name, entry] of productMap) {
    const roas = entry.spend > 0 ? entry.revenue / entry.spend : 0;
    const shareOfSpend = totalSpendAll > 0 ? entry.spend / totalSpendAll : 0;
    const shareOfRevenue = totalRevenueAll > 0 ? entry.revenue / totalRevenueAll : 0;

    // Calculate ROAS trend (second half vs first half)
    const firstHalfRoas =
      entry.firstHalfSpend > 0 ? entry.firstHalfRevenue / entry.firstHalfSpend : 0;
    const secondHalfRoas =
      entry.secondHalfSpend > 0 ? entry.secondHalfRevenue / entry.secondHalfSpend : 0;
    const roasTrendingUp = secondHalfRoas > firstHalfRoas;

    // Classification logic
    let classification: ProductClassification = 'unclassified';

    if (roas >= 2.0 && shareOfRevenue >= 0.15) {
      classification = 'champion';
    } else if (roas >= 2.0 && shareOfSpend < 0.10) {
      classification = 'hidden_gem';
    } else if (roas >= 1.5 && roasTrendingUp) {
      classification = 'growth_driver';
    } else if (roas < 1.0 && shareOfSpend >= 0.05) {
      classification = 'underperformer';
    }

    products.push({
      product_name: name,
      classification,
      total_spend: entry.spend,
      total_revenue: entry.revenue,
      total_purchases: entry.purchases,
      roas,
      share_of_spend: shareOfSpend,
      share_of_revenue: shareOfRevenue,
      ad_count: entry.adIds.size,
      recommendation: RECOMMENDATIONS[classification],
    });
  }

  // Sort by revenue descending
  products.sort((a, b) => b.total_revenue - a.total_revenue);

  return products;
}

export function useProductMVP() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['product-mvp', orgId],
    queryFn: () => fetchProductMVPData(orgId!),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  const products = data ?? [];

  const champions = products.filter((p) => p.classification === 'champion');
  const growthDrivers = products.filter((p) => p.classification === 'growth_driver');
  const hiddenGems = products.filter((p) => p.classification === 'hidden_gem');
  const underperformers = products.filter((p) => p.classification === 'underperformer');
  const unclassified = products.filter((p) => p.classification === 'unclassified');

  return {
    products,
    champions,
    growthDrivers,
    hiddenGems,
    underperformers,
    unclassified,
    isLoading,
  };
}
