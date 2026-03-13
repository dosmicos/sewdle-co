import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { format } from 'date-fns';
import type { DateRange } from './useFinanceDateRange';
import type { ProductCost } from './useProductCosts';
import type { GatewayCostSetting } from './useGatewayCosts';
import type { CostOverrides } from './useContributionMargin';

/**
 * Computes cost overrides (per-product COGS, per-gateway fees) for the CM calculation.
 * Fetches line items and orders for the given date range, then matches them against
 * product_costs and gateway_cost_settings.
 */
export function useCostOverrides(
  dateRange: DateRange,
  productCosts: ProductCost[],
  gatewayCosts: GatewayCostSetting[],
  cogsMode: string,
  gatewayMode: string,
): { overrides: CostOverrides; isLoading: boolean } {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr = format(dateRange.end, 'yyyy-MM-dd');

  // Fetch line items for per-product COGS calculation
  const lineItemsQuery = useQuery({
    queryKey: ['cost-overrides-line-items', orgId, startStr, endStr],
    queryFn: async () => {
      // Get valid order IDs in the range
      const { data: orders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('shopify_order_id')
        .eq('organization_id', orgId!)
        .gte('created_at_shopify', dateRange.start.toISOString())
        .lte('created_at_shopify', dateRange.end.toISOString())
        .not('financial_status', 'eq', 'voided')
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'refunded');

      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) return [];

      const orderIds = orders.map(o => o.shopify_order_id);

      // Fetch line items in batches (same pattern as useStoreMetrics)
      const batchSize = 50;
      const allLineItems: Array<{ product_id: number | null; variant_id: number | null; quantity: number }> = [];

      for (let i = 0; i < orderIds.length; i += batchSize) {
        const batch = orderIds.slice(i, i + batchSize);
        const { data: lineItems } = await supabase
          .from('shopify_order_line_items')
          .select('product_id, variant_id, quantity')
          .eq('organization_id', orgId!)
          .in('shopify_order_id', batch);

        if (lineItems) allLineItems.push(...lineItems);
      }

      return allLineItems;
    },
    enabled: !!orgId && cogsMode === 'per_product',
    staleTime: 1000 * 60 * 5,
  });

  // Fetch orders with raw_data for per-gateway fee calculation
  const ordersQuery = useQuery({
    queryKey: ['cost-overrides-orders', orgId, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_orders')
        .select('total_price, raw_data')
        .eq('organization_id', orgId!)
        .gte('created_at_shopify', dateRange.start.toISOString())
        .lte('created_at_shopify', dateRange.end.toISOString())
        .not('financial_status', 'eq', 'voided')
        .is('cancelled_at', null)
        .not('financial_status', 'eq', 'refunded');

      if (error) throw error;
      return (data || []) as Array<{ total_price: number; raw_data: Record<string, unknown> | null }>;
    },
    enabled: !!orgId && gatewayMode === 'per_gateway',
    staleTime: 1000 * 60 * 5,
  });

  const overrides = useMemo(() => {
    const result: CostOverrides = {};

    // Per-product COGS (product_cost only — handling is computed separately in CM hook)
    if (cogsMode === 'per_product' && lineItemsQuery.data && productCosts.length > 0) {
      let total = 0;
      for (const li of lineItemsQuery.data) {
        if (!li.product_id) continue;
        // Prefer exact variant match, fallback to product-level cost
        const match =
          productCosts.find(p => p.product_id === li.product_id && p.variant_id === li.variant_id) ||
          productCosts.find(p => p.product_id === li.product_id && !p.variant_id);

        if (match) {
          // Only product_cost — NOT handling_fee (handling is a separate line in CM)
          total += match.product_cost * li.quantity;
        }
      }
      result.productCost = total;
    }

    // Per-gateway fees
    if (gatewayMode === 'per_gateway' && ordersQuery.data && gatewayCosts.length > 0) {
      const gatewayMap = new Map(gatewayCosts.map(g => [g.gateway_name, g]));
      // Separate universal fees (applies_to_all, e.g. Shopify Transaction Fee)
      const universalFees = gatewayCosts.filter(g => g.applies_to_all && g.is_active);
      let total = 0;

      for (const order of ordersQuery.data) {
        // Apply universal fees to ALL orders (e.g. Shopify 1% transaction fee)
        for (const uf of universalFees) {
          total += order.total_price * (uf.percent_fee / 100) + uf.flat_fee;
        }

        // Apply per-gateway fees based on payment_gateway_names
        const raw = order.raw_data;
        if (!raw) continue;
        const names = (raw.payment_gateway_names as string[]) || [];
        const effectiveGateway = names.length > 0 ? names[names.length - 1] : null;
        if (!effectiveGateway) continue;

        const setting = gatewayMap.get(effectiveGateway);
        if (setting && setting.is_active && !setting.applies_to_all) {
          total += order.total_price * (setting.percent_fee / 100) + setting.flat_fee;
        }
      }
      result.paymentGatewayFees = total;
    }

    return result;
  }, [cogsMode, gatewayMode, lineItemsQuery.data, ordersQuery.data, productCosts, gatewayCosts]);

  return {
    overrides,
    isLoading: lineItemsQuery.isLoading || ordersQuery.isLoading,
  };
}
