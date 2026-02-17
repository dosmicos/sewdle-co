import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PickingOrder } from './usePickingOrders';

interface UsePickingOrderDetailsOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching and caching individual picking order details.
 * Uses React Query for caching with 30s staleTime to prevent redundant fetches
 * when navigating between orders.
 */
export const usePickingOrderDetails = (
  orderId: string | null,
  options: UsePickingOrderDetailsOptions = {}
) => {
  const queryClient = useQueryClient();
  const { enabled = true } = options;

  const { 
    data: order, 
    isLoading, 
    error, 
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['picking-order-details', orderId],
    queryFn: async ({ signal }): Promise<PickingOrder | null> => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('picking_packing_orders')
        .select(`
          *,
          shopify_order:shopify_orders(
            id,
            shopify_order_id,
            order_number,
            email,
            created_at_shopify,
            financial_status,
            fulfillment_status,
            customer_first_name,
            customer_last_name,
            customer_phone,
            customer_email,
            total_price,
            currency,
            note,
            tags,
            cancelled_at,
            raw_data
          )
        `)
        .eq('id', orderId)
        .abortSignal(signal)
        .single();

      if (error) {
        // Treat aborts as real cancellations so we don't cache `null` as valid data
        // (otherwise rapid navigation can leave an order "loaded" as null for 30s)
        if (error.message?.includes('aborted')) {
          throw new DOMException('aborted', 'AbortError');
        }
        throw error;
      }

      return {
        ...data,
        line_items: []
      } as PickingOrder;
    },
    enabled: !!orderId && enabled,
    staleTime: 30_000, // 30 seconds - data is considered fresh
    gcTime: 5 * 60_000, // 5 minutes - keep in memory for quick access
    retry: (failureCount, error: unknown) => {
      // Don't retry aborted requests
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return false;
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    // If a previous rapid navigation left cached data as null, force a refetch when mounted
    refetchOnMount: (query) => query.state.data === null,
  });

  /**
   * Optimistically update the cached order data.
   * Useful for immediate UI feedback when updating status, tags, etc.
   */
  const updateOrderOptimistically = (updater: (prev: PickingOrder | null) => PickingOrder | null) => {
    queryClient.setQueryData(['picking-order-details', orderId], (prev: PickingOrder | null) => {
      return updater(prev);
    });
  };

  /**
   * Invalidate the cache for this specific order.
   * Forces a refetch on next access.
   */
  const invalidateOrder = () => {
    queryClient.invalidateQueries({ queryKey: ['picking-order-details', orderId] });
  };

  /**
   * Prefetch an order's details before the user navigates to it.
   * Useful for preloading next/previous orders.
   */
  const prefetchOrder = async (targetOrderId: string) => {
    await queryClient.prefetchQuery({
      queryKey: ['picking-order-details', targetOrderId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('picking_packing_orders')
          .select(`
            *,
            shopify_order:shopify_orders(
              id,
              shopify_order_id,
              order_number,
              email,
              created_at_shopify,
              financial_status,
              fulfillment_status,
              customer_first_name,
              customer_last_name,
              customer_phone,
              customer_email,
              total_price,
              currency,
              note,
              tags,
              cancelled_at,
              raw_data
            )
          `)
          .eq('id', targetOrderId)
          .single();

        if (error) throw error;

        return {
          ...data,
          line_items: []
        } as PickingOrder;
      },
      staleTime: 30_000
    });
  };

  return {
    order,
    isLoading: isLoading && !order, // Only show loading if we don't have cached data
    isFetching, // True when fetching, even if we have stale data
    error,
    refetch,
    updateOrderOptimistically,
    invalidateOrder,
    prefetchOrder
  };
};
