import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useState } from 'react';

export interface ProductCost {
  id: string;
  organization_id: string;
  product_id: number;
  variant_id: number | null;
  title: string;
  sku: string | null;
  price: number;
  product_cost: number;
  handling_fee: number;
  source: 'shopify' | 'manual';
  updated_at: string;
}

export function useProductCosts() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const query = useQuery({
    queryKey: ['product-costs', orgId],
    queryFn: async (): Promise<ProductCost[]> => {
      const { data, error } = await supabase
        .from('product_costs')
        .select('*')
        .eq('organization_id', orgId!)
        .order('title');

      if (error) throw error;
      return (data as unknown as ProductCost[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: { product_cost?: number; handling_fee?: number };
    }) => {
      const { error } = await supabase
        .from('product_costs')
        .update({
          ...updates,
          source: 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-costs', orgId] });
    },
  });

  const syncFromShopify = async () => {
    if (!orgId) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-product-costs', {
        body: { organization_id: orgId },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['product-costs', orgId] });
      return data;
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute total COGS for a set of order line items
  const computeCOGS = (
    lineItems: Array<{
      product_id: number | null;
      variant_id: number | null;
      quantity: number;
    }>
  ): number => {
    const products = query.data || [];
    let total = 0;

    for (const li of lineItems) {
      if (!li.product_id) continue;
      // Find matching product cost (prefer variant match, fallback to product-only)
      const match =
        products.find(
          (p) => p.product_id === li.product_id && p.variant_id === li.variant_id
        ) || products.find((p) => p.product_id === li.product_id && !p.variant_id);

      if (match) {
        total += (match.product_cost + match.handling_fee) * li.quantity;
      }
    }
    return total;
  };

  return {
    products: query.data || [],
    isLoading: query.isLoading,
    isSyncing,
    syncFromShopify,
    updateProductCost: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    computeCOGS,
  };
}
