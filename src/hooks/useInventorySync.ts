
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

  // Fase 1: Verificación por SKU Individual (CORREGIDA)
  const checkSkuSyncStatus = async (deliveryId: string, skuVariants: string[]): Promise<SkuSyncStatus[]> => {
    try {
      console.log(`🔍 Verificando estado de sincronización para entrega ${deliveryId} con SKUs:`, skuVariants);
      
      // Consultar TODOS los logs de sincronización (verified Y failed)
      const { data: syncLogs, error } = await supabase
        .from('inventory_sync_logs')
        .select('sync_results, synced_at, verification_status')
        .eq('delivery_id', deliveryId)
        .in('verification_status', ['verified', 'failed'])
        .order('synced_at', { ascending: false });

      if (error) {
        console.error('❌ Error checking SKU sync status:', error);
        return skuVariants.map(sku => ({ skuVariant: sku, needsSync: true, isSynced: false }));
      }

      console.log(`📊 Encontrados ${syncLogs?.length || 0} logs de sincronización`);

      const skuStatuses: SkuSyncStatus[] = [];

      for (const sku of skuVariants) {
        let needsSync = true;
        let lastSyncAt: string | undefined;
        let isSynced = false;
        let lastStatus = 'never_synced';

        // Buscar el estado más reciente para este SKU
        for (const log of syncLogs || []) {
          if (log.sync_results && typeof log.sync_results === 'object') {
            const syncResults = log.sync_results as Record<string, unknown>;
            if (syncResults.results && Array.isArray(syncResults.results)) {
              const skuResult = syncResults.results.find((r: unknown) => r.skuVariant === sku || r.sku === sku);
              
              if (skuResult) {
                lastSyncAt = log.synced_at;
                lastStatus = log.verification_status;
                
                // Solo marcar como sincronizado si el log es 'verified' Y el SKU fue exitoso
                if (log.verification_status === 'verified' && skuResult.success) {
                  needsSync = false;
                  isSynced = true;
                  console.log(`✅ SKU ${sku}: Ya sincronizado exitosamente el ${new Date(log.synced_at).toLocaleString()}`);
                  break;
                } else if (log.verification_status === 'failed' || !skuResult.success) {
                  needsSync = true;
                  isSynced = false;
                  console.log(`❌ SKU ${sku}: Falló sincronización el ${new Date(log.synced_at).toLocaleString()}, necesita re-sync`);
                  break; // El más reciente determina el estado
                }
              }
            }
          }
        }

        if (!lastSyncAt) {
          console.log(`🆕 SKU ${sku}: Sin logs de sincronización, necesita sync inicial`);
        }

        skuStatuses.push({
          skuVariant: sku,
          needsSync,
          lastSyncAt,
          isSynced
        });
      }

      console.log(`📋 Resultado final: ${skuStatuses.filter(s => s.needsSync).length} SKUs necesitan sync, ${skuStatuses.filter(s => s.isSynced).length} ya sincronizados`);
      return skuStatuses;
    } catch (error) {
      console.error('❌ Error checking SKU sync status:', error);
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
          // Verificar si hay algún SKU que falló recientemente
          const failedSkus = skuStatuses.filter(s => !s.isSynced && s.lastSyncAt);
          
          if (failedSkus.length > 0) {
            toast({
              title: "Error: SKUs requieren atención",
              description: `${failedSkus.length} SKUs fallaron en sincronizaciones anteriores y necesitan revisión. Usa "Forzar Sincronización" para reintentarlos.`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Todos los SKUs ya sincronizados",
              description: `Los ${alreadySyncedCount} SKUs de esta entrega ya fueron sincronizados exitosamente.`,
            });
          }
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
      
      // Handle 409 Conflict - sync in progress
      if (!result.success && result.error === 'sync_in_progress') {
        const lockDetails = result.details;
        const lockTime = lockDetails?.lock_acquired_at ? 
          new Date(lockDetails.lock_acquired_at).toLocaleString() : 'desconocida';
        
        toast({
          title: "Sincronización en progreso",
          description: `Ya hay una sincronización activa para ${lockDetails?.tracking_number || 'esta entrega'} desde ${lockTime}. Intenta nuevamente en unos momentos.`,
          variant: "destructive",
        });
        
        setLoading(false);
        return { 
          success: false, 
          error: 'sync_in_progress',
          lockInfo: lockDetails,
          summary: { successful: 0, failed: 0, already_synced: 0 }
        };
      }
      
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
      
      let errorMessage = "No se pudo sincronizar el inventario con Shopify";
      
      if (error instanceof Error) {
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          errorMessage = "Shopify está limitando las peticiones. Intenta nuevamente en unos minutos.";
        } else if (error.message.includes('sync_in_progress')) {
          errorMessage = "Ya hay una sincronización en progreso. Espera a que termine o libera el bloqueo si está atorado.";
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
        .select('synced_to_shopify, sync_error_message')
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

  const checkSyncLockStatus = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase.rpc('check_delivery_sync_lock', {
        delivery_uuid: deliveryId
      });

      if (error) {
        throw error;
      }

      return data === true; // Returns true if lock is held, false if not
    } catch (error) {
      console.error('Error checking sync lock status:', error);
      return false;
    }
  };

  const clearSyncLock = async (deliveryId: string) => {
    try {
      const { data: lockReleased, error: lockError } = await supabase.rpc('release_delivery_sync_lock', {
        delivery_uuid: deliveryId
      });

      if (lockError) {
        throw lockError;
      }

      // Update delivery lock tracking info
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          sync_lock_acquired_at: null,
          sync_lock_acquired_by: null
        })
        .eq('id', deliveryId);

      if (updateError) {
        console.warn('Warning: Lock released but tracking info not updated:', updateError);
      }

      if (lockReleased) {
        toast({
          title: "Bloqueo de sincronización liberado",
          description: "El bloqueo de sincronización ha sido liberado exitosamente",
        });
        return true;
      } else {
        toast({
          title: "Sin bloqueo para liberar",
          description: "No había ningún bloqueo de sincronización activo",
        });
        return false;
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
      // Clear all advisory locks older than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: staleDeliveries, error: queryError } = await supabase
        .from('deliveries')
        .select('id, tracking_number, sync_lock_acquired_at')
        .not('sync_lock_acquired_at', 'is', null)
        .lt('sync_lock_acquired_at', oneHourAgo);

      if (queryError) {
        throw queryError;
      }

      let clearedCount = 0;
      
      if (staleDeliveries && staleDeliveries.length > 0) {
        for (const delivery of staleDeliveries) {
          try {
            await clearSyncLock(delivery.id);
            clearedCount++;
          } catch (error) {
            console.warn(`Failed to clear lock for ${delivery.tracking_number}:`, error);
          }
        }
      }

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

      return clearedCount;
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
    checkRecentSuccessfulSync,
    checkSkuSyncStatus,
    checkSyncLockStatus,
    clearSyncLock,
    clearAllStaleLocks,
    loading
  };
};
