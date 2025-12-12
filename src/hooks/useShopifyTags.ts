import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useShopifyTags = () => {
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all unique tags from Shopify orders with pagination
  const fetchAvailableTags = async () => {
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
      setAvailableTags(sortedTags);
      
      console.log(`✅ Loaded ${sortedTags.length} unique tags from Shopify (processed ${page} batches)`);
    } catch (error) {
      console.error('❌ Error fetching available tags:', error);
      setAvailableTags([]);
      toast.error('Error al cargar etiquetas disponibles');
    } finally {
      setLoading(false);
    }
  };

  // Add tag to order
  const addTagToOrder = async (
    orderId: string, 
    shopifyOrderId: number, 
    tag: string, 
    currentTags: string
  ): Promise<string | null> => {
    setLoading(true);
    try {
      // Parse current tags
      const tagsArray = currentTags 
        ? currentTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      // Check if tag already exists
      if (tagsArray.includes(tag)) {
        toast.error('La etiqueta ya existe en esta orden');
        return null;
      }

      // Add new tag
      tagsArray.push(tag);
      const newTagsString = tagsArray.join(', ');

      console.log(`🏷️ Adding tag "${tag}" to order ${shopifyOrderId}`);
      
      // Update Shopify via edge function
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'update-shopify-order',
        {
          body: {
            orderId: shopifyOrderId,
            action: 'update_tags',
            data: {
              tags: tagsArray,
              previousTags: currentTags
            }
          }
        }
      );

      if (functionError) throw functionError;
      if (!functionData?.success) throw new Error(functionData?.error || 'Error updating Shopify');

      // Update local database
      const { error: dbError } = await supabase
        .from('shopify_orders')
        .update({ tags: newTagsString })
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

      return newTagsString;
    } catch (error: any) {
      console.error('❌ Error adding tag:', error);
      toast.error(error.message || 'Error al agregar etiqueta');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Remove tag from order
  const removeTagFromOrder = async (
    orderId: string,
    shopifyOrderId: number,
    tag: string,
    currentTags: string
  ): Promise<string | null> => {
    setLoading(true);
    try {
      // Parse current tags
      const tagsArray = currentTags 
        ? currentTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : [];

      // Remove tag
      const newTagsArray = tagsArray.filter(t => t !== tag);
      const newTagsString = newTagsArray.join(', ');

      console.log(`🏷️ Removing tag "${tag}" from order ${shopifyOrderId}`);
      
      // Update Shopify via edge function
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'update-shopify-order',
        {
          body: {
            orderId: shopifyOrderId,
            action: 'update_tags',
            data: {
              tags: newTagsArray,
              previousTags: currentTags
            }
          }
        }
      );

      if (functionError) throw functionError;
      if (!functionData?.success) throw new Error(functionData?.error || 'Error updating Shopify');

      // Update local database
      const { error: dbError } = await supabase
        .from('shopify_orders')
        .update({ tags: newTagsString })
        .eq('shopify_order_id', shopifyOrderId);

      if (dbError) {
        console.error('⚠️ Warning: Shopify updated but local DB failed:', dbError);
        toast.error('Advertencia: Error al actualizar base de datos local');
      }

      toast.success(`Etiqueta "${tag}" eliminada correctamente`);
      return newTagsString;
    } catch (error: any) {
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
