import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { type DateRange } from './useFinanceDateRange';

export interface PaymentGatewayBreakdownRow {
  gateway: string;
  label: string;
  orders: number;
  revenue: number;
  orderPct: number;
  revenuePct: number;
}

export interface PaymentGatewayBreakdownResult {
  rows: PaymentGatewayBreakdownRow[];
  totalOrders: number;
  totalRevenue: number;
  isLoading: boolean;
}

const GATEWAY_LABEL_OVERRIDES: Record<string, string> = {
  addi: 'Addi',
  bold: 'Bold',
  manual: 'Pago Manual',
  bank_deposit: 'Transferencia Bancaria',
  cash_on_delivery: 'Contraentrega',
  shopify_payments: 'Shopify Payments',
  mercadopago: 'MercadoPago',
  wompi: 'Wompi',
  payu: 'PayU',
  paypal: 'PayPal',
  stripe: 'Stripe',
};

function prettifyGateway(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (GATEWAY_LABEL_OVERRIDES[key]) return GATEWAY_LABEL_OVERRIDES[key];
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getNetPrice(order: { total_price: number | null; current_total_price: unknown }): number {
  const net = order.current_total_price;
  if (net != null) {
    const parsed = typeof net === 'string' ? parseFloat(net) : (net as number);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return order.total_price || 0;
}

function extractGateway(rawData: unknown): string | null {
  if (!rawData || typeof rawData !== 'object') return null;
  const record = rawData as Record<string, unknown>;

  const names = record.payment_gateway_names;
  if (Array.isArray(names) && names.length > 0) {
    const first = names.find((n) => typeof n === 'string' && n.trim().length > 0);
    if (first) return (first as string).trim();
  }

  const gateway = record.gateway;
  if (typeof gateway === 'string' && gateway.trim().length > 0) {
    return gateway.trim();
  }

  return null;
}

async function fetchGatewayOrders(orgId: string, startStr: string, endStr: string) {
  const pageSize = 1000;
  const allOrders: Array<{
    total_price: number | null;
    current_total_price: unknown;
    raw_data: unknown;
  }> = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('shopify_orders')
      .select('total_price, raw_data')
      .eq('organization_id', orgId)
      .gte('created_at_shopify', startStr)
      .lte('created_at_shopify', endStr)
      .not('financial_status', 'eq', 'voided')
      .not('financial_status', 'eq', 'refunded')
      .is('cancelled_at', null)
      .order('created_at_shopify', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const raw = (row as { raw_data: unknown }).raw_data;
      const currentTotal = raw && typeof raw === 'object'
        ? (raw as Record<string, unknown>).current_total_price
        : null;
      allOrders.push({
        total_price: (row as { total_price: number | null }).total_price,
        current_total_price: currentTotal,
        raw_data: raw,
      });
    }

    from += pageSize;
    hasMore = data.length === pageSize;
  }

  return allOrders;
}

async function fetchBreakdown(orgId: string, range: DateRange): Promise<Omit<PaymentGatewayBreakdownResult, 'isLoading'>> {
  const startStr = range.start.toISOString();
  const endStr = range.end.toISOString();

  const orders = await fetchGatewayOrders(orgId, startStr, endStr);

  const buckets = new Map<string, { orders: number; revenue: number }>();
  let totalOrders = 0;
  let totalRevenue = 0;

  for (const order of orders) {
    const gatewayRaw = extractGateway(order.raw_data) ?? 'desconocido';
    const key = gatewayRaw.toLowerCase();
    const revenue = getNetPrice(order);

    const bucket = buckets.get(key) ?? { orders: 0, revenue: 0 };
    bucket.orders += 1;
    bucket.revenue += revenue;
    buckets.set(key, bucket);

    totalOrders += 1;
    totalRevenue += revenue;
  }

  const rows: PaymentGatewayBreakdownRow[] = Array.from(buckets.entries())
    .map(([gateway, { orders, revenue }]) => ({
      gateway,
      label: prettifyGateway(gateway),
      orders,
      revenue,
      orderPct: totalOrders > 0 ? (orders / totalOrders) * 100 : 0,
      revenuePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.orders - a.orders);

  return { rows, totalOrders, totalRevenue };
}

export function usePaymentGatewayBreakdown(range: DateRange): PaymentGatewayBreakdownResult {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const query = useQuery({
    queryKey: [
      'payment-gateway-breakdown',
      orgId,
      format(range.start, 'yyyy-MM-dd'),
      format(range.end, 'yyyy-MM-dd'),
    ],
    queryFn: () => fetchBreakdown(orgId!, range),
    enabled: !!orgId,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  return {
    rows: query.data?.rows ?? [],
    totalOrders: query.data?.totalOrders ?? 0,
    totalRevenue: query.data?.totalRevenue ?? 0,
    isLoading: query.isLoading,
  };
}
