
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
      console.log('Syncing approved items to Shopify with enhanced rate limiting:', syncData);

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
        
        // Enhanced success message with rate limiting info
        let message = `${totalProcessed} productos procesados`;
        if (successfulCount > 0) {
          message += ` (${successfulCount} sincronizados`;
          if (alreadySyncedCount > 0) {
            message += `, ${alreadySyncedCount} ya estaban sincronizados`;
          }
          message += ')';
        } else if (alreadySyncedCount > 0) {
          message += ` - todos ya estaban sincronizados correctamente`;
        }

        // Add rate limiting info if available
        if (result.diagnostics?.rate_limiting) {
          message += `. Sincronización optimizada con control de velocidad.`;
        }

        toast({
          title: "Inventario sincronizado",
          description: message,
        });
        
        if (result.summary.failed > 0) {
          toast({
            title: "Advertencia",
            description: `${result.summary.failed} productos no se pudieron sincronizar. Revisa los detalles en el diagnóstico.`,
            variant: "destructive",
          });
        }
      } else {
        throw new Error(result.error || 'Error desconocido en la sincronización');
      }

      return result;

    } catch (error) {
      console.error('Error syncing inventory:', error);
      
      // Enhanced error handling for rate limiting
      let errorMessage = "No se pudo sincronizar el inventario con Shopify";
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = "Shopify está limitando las peticiones. La sincronización se reintentará automáticamente con velocidad controlada.";
        } else if (error.message.includes('Sincronización ya en progreso')) {
          errorMessage = "Ya hay una sincronización en progreso. Espera unos minutos e intenta nuevamente.";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error de sincronización",
        description: errorMessage,
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
        .select('synced_to_shopify, sync_attempts, last_sync_attempt, sync_error_message')
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
