
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

interface SkuSyncStatus {
  skuVariant: string;
  needsSync: boolean;
  lastSyncAt?: string;
  isSynced: boolean;
}

export const useInventorySync = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fase 1: Verificación por SKU Individual
  const checkSkuSyncStatus = async (deliveryId: string, skuVariants: string[]): Promise<SkuSyncStatus[]> => {
    try {
      // Consultar logs de sincronización por SKU específico
      const { data: syncLogs, error } = await supabase
        .from('inventory_sync_logs')
        .select('sync_results, synced_at, verification_status')
        .eq('delivery_id', deliveryId)
        .eq('verification_status', 'verified')
        .order('synced_at', { ascending: false });

      if (error) {
        console.error('Error checking SKU sync status:', error);
        return skuVariants.map(sku => ({ skuVariant: sku, needsSync: true, isSynced: false }));
      }

      const skuStatuses: SkuSyncStatus[] = [];

      for (const sku of skuVariants) {
        let needsSync = true;
        let lastSyncAt: string | undefined;
        let isSynced = false;

        // Buscar en los logs si este SKU fue sincronizado exitosamente
        for (const log of syncLogs || []) {
          if (log.sync_results && typeof log.sync_results === 'object') {
            const syncResults = log.sync_results as any;
            if (syncResults.results && Array.isArray(syncResults.results)) {
              const skuResult = syncResults.results.find((r: any) => r.skuVariant === sku);
              if (skuResult?.success && skuResult?.verified) {
                needsSync = false;
                lastSyncAt = log.synced_at;
                isSynced = true;
                break;
              }
            }
          }
        }

        skuStatuses.push({
          skuVariant: sku,
          needsSync,
          lastSyncAt,
          isSynced
        });
      }

      return skuStatuses;
    } catch (error) {
      console.error('Error checking SKU sync status:', error);
      return skuVariants.map(sku => ({ skuVariant: sku, needsSync: true, isSynced: false }));
    }
  };

  const checkRecentSuccessfulSync = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_recent_successful_sync', {
        delivery_id_param: deliveryId,
        minutes_threshold: 30
      });

      if (error) {
        console.error('Error checking recent sync:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error checking recent sync:', error);
      return false;
    }
  };

  const syncApprovedItemsToShopify = async (syncData: SyncInventoryData, onlyPending: boolean = true) => {
    setLoading(true);
    
    try {
      let itemsToSync = syncData.approvedItems;

      if (onlyPending) {
        // Fase 1: Verificar qué SKUs necesitan sincronización
        const skuVariants = syncData.approvedItems.map(item => item.skuVariant);
        const skuStatuses = await checkSkuSyncStatus(syncData.deliveryId, skuVariants);
        
        // Filtrar solo los items que necesitan sincronización
        itemsToSync = syncData.approvedItems.filter(item => {
          const status = skuStatuses.find(s => s.skuVariant === item.skuVariant);
          return status?.needsSync !== false;
        });

        const alreadySyncedCount = syncData.approvedItems.length - itemsToSync.length;
        
        if (itemsToSync.length === 0) {
          toast({
            title: "Todos los SKUs ya sincronizados",
            description: `Los ${alreadySyncedCount} SKUs de esta entrega ya fueron sincronizados exitosamente.`,
            variant: "destructive",
          });
          setLoading(false);
          return { success: false, error: 'All SKUs already synced', summary: { already_synced: alreadySyncedCount } };
        }

        if (alreadySyncedCount > 0) {
          toast({
            title: "Sincronización inteligente",
            description: `Se sincronizarán ${itemsToSync.length} SKUs pendientes. ${alreadySyncedCount} SKUs ya estaban sincronizados.`,
          });
        }
      }
      
      console.log('🔄 Iniciando sincronización con Shopify:', {
        deliveryId: syncData.deliveryId,
        originalItems: syncData.approvedItems.length,
        itemsToSync: itemsToSync.length,
        onlyPending
      });

      const { data, error } = await supabase.functions.invoke('sync-inventory-shopify', {
        body: {
          ...syncData,
          approvedItems: itemsToSync,
          intelligentSync: onlyPending
        }
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
      
      // Enhanced error handling for sync locks and rate limiting
      let errorMessage = "No se pudo sincronizar el inventario con Shopify";
      let showRetryOption = false;
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = "Shopify está limitando las peticiones. La sincronización se reintentará automáticamente con velocidad controlada.";
        } else if (error.message.includes('Sincronización ya en progreso')) {
          errorMessage = "Ya hay una sincronización en progreso. Espera unos minutos e intenta nuevamente.";
          showRetryOption = true;
        } else if (error.message.includes('canRetryAt')) {
          // Parse enhanced lock info
          try {
            const errorData = JSON.parse(error.message);
            const retryTime = new Date(errorData.canRetryAt).toLocaleTimeString();
            errorMessage = `Sincronización en progreso (${errorData.lockAgeMinutes} min). Reintentar después de ${retryTime}.`;
            showRetryOption = true;
          } catch {
            errorMessage = error.message;
            showRetryOption = true;
          }
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

  const clearSyncLock = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase.rpc('clear_delivery_sync_lock', {
        delivery_id_param: deliveryId
      });

      if (error) {
        throw error;
      }

      const result = data as any;
      if (result?.success) {
        toast({
          title: "Bloqueo de sincronización limpiado",
          description: `Se ha liberado el bloqueo para la entrega ${result.tracking_number}`,
        });
        return result;
      } else {
        throw new Error(result?.error || 'Error desconocido al limpiar el bloqueo');
      }
    } catch (error) {
      console.error('Error clearing sync lock:', error);
      toast({
        title: "Error al limpiar bloqueo",
        description: error instanceof Error ? error.message : "No se pudo limpiar el bloqueo de sincronización",
        variant: "destructive",
      });
      throw error;
    }
  };

  const clearAllStaleLocks = async () => {
    try {
      const { data, error } = await supabase.rpc('clear_stale_sync_locks');

      if (error) {
        throw error;
      }

      const clearedCount = (data?.[0] as any)?.cleared_deliveries_count || 0;
      
      if (clearedCount > 0) {
        toast({
          title: "Bloqueos antiguos limpiados",
          description: `Se han liberado ${clearedCount} bloqueos de sincronización antiguos`,
        });
      } else {
        toast({
          title: "Sin bloqueos para limpiar",
          description: "No se encontraron bloqueos de sincronización antiguos",
        });
      }

      return data;
    } catch (error) {
      console.error('Error clearing stale locks:', error);
      toast({
        title: "Error al limpiar bloqueos",
        description: error instanceof Error ? error.message : "No se pudieron limpiar los bloqueos antiguos",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    syncApprovedItemsToShopify,
    fetchSyncLogs,
    checkSyncStatus,
    clearSyncLock,
    clearAllStaleLocks,
    checkRecentSuccessfulSync,
    checkSkuSyncStatus,
    loading
  };
};
