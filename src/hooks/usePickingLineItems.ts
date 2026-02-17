import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ShopifyLineItem {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  price: number;
  quantity: number;
  product_id: number | null;
  variant_id: number | null;
  image_url: string | null;
  shopify_line_item_id: number;
  properties: { name: string; value: string }[] | null;
}

interface RawLineItem {
  id: number;
  image?: { src: string };
  featured_image?: string;
}

/**
 * Hook for fetching line items for a Shopify order with caching.
 * - 30 second staleTime for instant loading of visited orders
 * - 15 second timeout with error state
 * - Completely independent of shipping API calls
 */
export const usePickingLineItems = (
  shopifyOrderId: number | null,
  rawLineItems?: RawLineItem[]
) => {
  const queryClient = useQueryClient();

  const { 
    data: lineItems = [], 
    isLoading, 
    error, 
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['picking-line-items', shopifyOrderId],
    queryFn: async ({ signal }): Promise<ShopifyLineItem[]> => {
      if (!shopifyOrderId) return [];

      const start = performance.now();
      console.log('⏱️ Iniciando carga de productos para orden', shopifyOrderId);

      // Create timeout promise for 15 seconds
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT: La carga de productos tomó demasiado tiempo'));
        }, 15000);
      });

      const fetchPromise = async (): Promise<ShopifyLineItem[]> => {
        // Step 1: Fetch line items from database
        const { data, error: fetchError } = await supabase
          .from('shopify_order_line_items')
          .select('id, title, variant_title, sku, price, quantity, product_id, variant_id, image_url, shopify_line_item_id, properties')
          .eq('shopify_order_id', shopifyOrderId);

        if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
        if (fetchError) throw fetchError;
        if (!data) return [];

        // Step 2: Enrich with fallback images from raw_data
        let enrichedItems = (data as ShopifyLineItem[]).map(item => {
          const rawItem = rawLineItems?.find((ri) => ri.id === item.shopify_line_item_id);
          return {
            ...item,
            image_url: item.image_url || rawItem?.image?.src || rawItem?.featured_image || null
          };
        });

        if (signal?.aborted) throw new DOMException('aborted', 'AbortError');

        // Step 3: Fetch Shopify variant images in parallel (FAST - no individual waits)
        const itemsWithShopifyIds = enrichedItems.filter(item => item.product_id && item.variant_id);
        
        if (itemsWithShopifyIds.length > 0) {
          try {
            const imagePromises = itemsWithShopifyIds.map(async (item) => {
              try {
                const { data: imgData } = await supabase.functions.invoke('get-shopify-variant-image', {
                  body: { product_id: item.product_id, variant_id: item.variant_id }
                });
                return { sku: item.sku, image_url: imgData?.image_url || null };
              } catch {
                return { sku: item.sku, image_url: null };
              }
            });

            const shopifyImages = await Promise.all(imagePromises);
            
            if (!signal?.aborted) {
              const skuToImageMap = new Map(
                shopifyImages.map(img => [img.sku, img.image_url])
              );

              enrichedItems = enrichedItems.map(item => ({
                ...item,
                image_url: skuToImageMap.get(item.sku) || item.image_url
              }));
            }
          } catch (imgError) {
            console.warn('Error fetching Shopify images, using fallbacks:', imgError);
          }
        }

        if (signal?.aborted) throw new DOMException('aborted', 'AbortError');

        // Step 4: Final fallback from product_variants table
        const itemsStillWithoutImages = enrichedItems.filter(item => !item.image_url && item.sku);
        
        if (itemsStillWithoutImages.length > 0) {
          try {
            const skus = itemsStillWithoutImages.map(item => item.sku).filter((sku): sku is string => Boolean(sku));
            
            const { data: variantData } = await supabase
              .from('product_variants')
              .select('sku_variant, products(image_url)')
              .in('sku_variant', skus);

            if (!signal?.aborted && variantData) {
              const skuToImageMap = new Map<string, string | null>();
              (variantData as Array<{ sku_variant: string; products: { image_url: string | null } | null }>).forEach((v) => {
                if (v.sku_variant) {
                  skuToImageMap.set(v.sku_variant, v.products?.image_url || null);
                }
              });

              enrichedItems = enrichedItems.map(item => ({
                ...item,
                image_url: item.image_url || (item.sku ? skuToImageMap.get(item.sku) || null : null)
              }));
            }
          } catch (fallbackError) {
            console.warn('Error fetching fallback images:', fallbackError);
          }
        }

        return enrichedItems;
      };

      // Race between fetch and timeout
      try {
        const result = await Promise.race([fetchPromise(), timeoutPromise]);
        const ms = Math.round(performance.now() - start);
        console.log('✅ Productos cargados para orden', shopifyOrderId, 'en', `${ms}ms`);
        return result;
      } catch (err: unknown) {
        const ms = Math.round(performance.now() - start);
        console.error('❌ Error cargando productos para orden', shopifyOrderId, `(${ms}ms):`, err?.message || err);
        throw err;
      }
    },
    enabled: !!shopifyOrderId,
    staleTime: 30_000, // 30 seconds - data is considered fresh
    gcTime: 5 * 60_000, // 5 minutes - keep in memory
    retry: (failureCount, error: unknown) => {
      // Don't retry timeouts or aborts
      if (error?.message?.includes('TIMEOUT')) return false;
      if (error?.name === 'AbortError' || error?.message?.includes('aborted')) return false;
      return failureCount < 1; // Only 1 retry for other errors
    },
    refetchOnWindowFocus: false,
  });

  const isTimeout = error?.message?.includes('TIMEOUT');
  const hasError = !!error;

  return {
    lineItems,
    isLoading: isLoading && lineItems.length === 0,
    isFetching,
    hasError,
    isTimeout,
    errorMessage: error?.message || null,
    refetch,
    // Helper for manual cache invalidation
    invalidateLineItems: () => {
      queryClient.invalidateQueries({ queryKey: ['picking-line-items', shopifyOrderId] });
    }
  };
};
