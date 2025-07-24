
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncInventoryData {
  deliveryId: string;
  approvedItems: {
    variantId: string;
    skuVariant: string;
    quantityApproved: number;
  }[];
}

export const useInventorySync = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const syncApprovedItemsToShopify = async (syncData: SyncInventoryData) => {
    setLoading(true);
    try {
      console.log('Syncing approved items to Shopify:', syncData);

      const { data, error } = await supabase.functions.invoke('sync-inventory-shopify', {
        body: syncData
      });

      if (error) {
        throw error;
      }

      const result = data;
      
      if (result.success) {
        const alreadySyncedCount = result.summary.already_synced || 0;
        const successfulCount = result.summary.successful || 0;
        const totalProcessed = successfulCount + alreadySyncedCount;
        
        toast({
          title: "Inventario sincronizado",
          description: `${totalProcessed} productos procesados (${successfulCount} sincronizados, ${alreadySyncedCount} ya estaban sincronizados)`,
        });
        
        if (result.summary.failed > 0) {
          toast({
            title: "Advertencia",
            description: `${result.summary.failed} productos no se pudieron sincronizar`,
            variant: "destructive",
          });
        }
      } else {
        throw new Error(result.error || 'Error desconocido en la sincronización');
      }

      return result;

    } catch (error) {
      console.error('Error syncing inventory:', error);
      toast({
        title: "Error de sincronización",
        description: error instanceof Error ? error.message : "No se pudo sincronizar el inventario con Shopify",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncLogs = async (deliveryId?: string) => {
    try {
      let query = supabase
        .from('inventory_sync_logs')
        .select('*')
        .order('synced_at', { ascending: false });

      if (deliveryId) {
        query = query.eq('delivery_id', deliveryId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching sync logs:', error);
      return [];
    }
  };

  const checkSyncStatus = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('sync_in_progress, last_sync_attempt, synced_to_shopify')
        .eq('id', deliveryId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error checking sync status:', error);
      return null;
    }
  };

  return {
    syncApprovedItemsToShopify,
    fetchSyncLogs,
    checkSyncStatus,
    loading
  };
};
