import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Module-level cache to avoid redundant fetches across component mounts
let cachedTags: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export const useShopifyTags = () => {
  const [availableTags, setAvailableTags] = useState<string[]>(cachedTags || []);
  const [loading, setLoading] = useState(cachedTags === null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch all unique tags from Shopify orders with pagination
  const fetchAvailableTags = async (forceRefresh = false) => {
    // Use cache if valid and not forcing refresh
    const now = Date.now();
    if (!forceRefresh && cachedTags !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
      setAvailableTags(cachedTags);
      setLoading(false);
      return;
    }

    // Cancel any ongoing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const tagsSet = new Set<string>();
      const BATCH_SIZE = 1000;
      let page = 0;
      let hasMore = true;

      // Paginate through ALL records to get all tags
      while (hasMore) {
        const from = page * BATCH_SIZE;
        const to = from + BATCH_SIZE - 1;

        const { data, error } = await supabase
          .from('shopify_orders')
          .select('tags')
          .not('tags', 'is', null)
          .not('tags', 'eq', '')
          .range(from, to);

        if (error) throw error;

        // Process tags from this batch
        data?.forEach(order => {
          if (order.tags) {
            const tags = order.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
            tags.forEach(tag => tagsSet.add(tag));
          }
        });

        // Check if there are more records
        hasMore = data?.length === BATCH_SIZE;
        page++;
      }

      const sortedTags = Array.from(tagsSet).sort((a, b) => a.localeCompare(b)).filter(Boolean);
      
      // Update cache
      cachedTags = sortedTags;
      cacheTimestamp = Date.now();
      
      setAvailableTags(sortedTags);
      
      console.log(`✅ Loaded ${sortedTags.length} unique tags from Shopify (processed ${page} batches)`);
    } catch (error) {
      // Silent error - don't show toast for background operations
      console.error('❌ Error fetching available tags:', error);
      // Use cached tags if available, otherwise empty
      setAvailableTags(cachedTags || []);
    } finally {
      setLoading(false);
    }
  };

  // Add tag to order using merge action (Shopify as source of truth)
  const addTagToOrder = async (
    orderId: string, 
    shopifyOrderId: number, 
    tag: string, 
    currentTags: string
  ): Promise<string | null> => {
    setLoading(true);
    try {
      console.log(`🏷️ Adding tag "${tag}" to order ${shopifyOrderId} using merge...`);
      
      // Use add_tags action - it reads from Shopify, merges, and updates
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'update-shopify-order',
        {
          body: {
            orderId: shopifyOrderId,
            action: 'add_tags',
            data: { tags: [tag] }
          }
        }
      );

      if (functionError) throw functionError;
      if (!functionData?.success) throw new Error(functionData?.error || 'Error updating Shopify');

      // Update local database with final tags from response
      const finalTagsString = functionData.finalTags 
        ? (Array.isArray(functionData.finalTags) ? functionData.finalTags.join(', ') : functionData.finalTags)
        : currentTags + (currentTags ? ', ' : '') + tag;
      
      const { error: dbError } = await supabase
        .from('shopify_orders')
        .update({ tags: finalTagsString })
        .eq('shopify_order_id', shopifyOrderId);

      if (dbError) {
        console.error('⚠️ Warning: Shopify updated but local DB failed:', dbError);
        toast.error('Advertencia: Error al actualizar base de datos local');
      }

      toast.success(`Etiqueta "${tag}" agregada correctamente`);
      
      // Refresh available tags if it's a new tag
      if (!availableTags.includes(tag)) {
        await fetchAvailableTags();
      }

      return finalTagsString;
    } catch (error: unknown) {
      console.error('❌ Error adding tag:', error);
      toast.error(error.message || 'Error al agregar etiqueta');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Remove tag from order using remove_tags action (Shopify as source of truth)
  const removeTagFromOrder = async (
    orderId: string,
    shopifyOrderId: number,
    tag: string,
    currentTags: string
  ): Promise<string | null> => {
    setLoading(true);
    try {
      console.log(`🏷️ Removing tag "${tag}" from order ${shopifyOrderId} using merge...`);
      
      // Use remove_tags action - it reads from Shopify, removes, and updates
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'update-shopify-order',
        {
          body: {
            orderId: shopifyOrderId,
            action: 'remove_tags',
            data: { tags: [tag] }
          }
        }
      );

      if (functionError) throw functionError;
      if (!functionData?.success) throw new Error(functionData?.error || 'Error updating Shopify');

      // Update local database with final tags from response
      const finalTagsString = functionData.finalTags 
        ? (Array.isArray(functionData.finalTags) ? functionData.finalTags.join(', ') : functionData.finalTags)
        : currentTags.split(',').map(t => t.trim()).filter(t => t !== tag).join(', ');
      
      const { error: dbError } = await supabase
        .from('shopify_orders')
        .update({ tags: finalTagsString })
        .eq('shopify_order_id', shopifyOrderId);

      if (dbError) {
        console.error('⚠️ Warning: Shopify updated but local DB failed:', dbError);
        toast.error('Advertencia: Error al actualizar base de datos local');
      }

      toast.success(`Etiqueta "${tag}" eliminada correctamente`);
      return finalTagsString;
    } catch (error: unknown) {
      console.error('❌ Error removing tag:', error);
      toast.error(error.message || 'Error al eliminar etiqueta');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableTags();
  }, []);

  return {
    availableTags,
    loading,
    fetchAvailableTags,
    addTagToOrder,
    removeTagFromOrder
  };
};
