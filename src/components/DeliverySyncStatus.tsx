
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Zap,
  Info
} from 'lucide-react';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useToast } from '@/hooks/use-toast';

import { resyncDeliveryStatus } from '@/utils/resyncDeliveryStatus';

interface DeliverySyncStatusProps {
  delivery: any;
  onSyncSuccess?: () => void;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const DeliverySyncStatus = ({ 
  delivery, 
  onSyncSuccess, 
  showDetails = false,
  size = 'md' 
}: DeliverySyncStatusProps) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const { syncApprovedItemsToShopify, loading } = useInventorySync();
  const { toast } = useToast();

  // Calcular estado de sincronización
  const getSyncStats = () => {
    const items = delivery.delivery_items || [];
    const totalItems = items.length;
    
    // Solo considerar items que han sido revisados en calidad (approved + defective > 0)
    const reviewedItems = items.filter((item: any) => 
      (item.quantity_approved || 0) + (item.quantity_defective || 0) > 0
    );
    
    const itemsWithApprovedQty = items.filter((item: any) => 
      item.quantity_approved > 0
    ).length;
    
    // CORRECCIÓN: Detectar errores tanto a nivel de entrega como de items
    const failedItems = items.filter((item: any) => 
      item.quantity_approved > 0 && (!item.synced_to_shopify || item.sync_error_message)
    ).length;

    // CORRECCIÓN: Detectar errores a nivel de entrega
    const hasDeliveryError = delivery.sync_error_message || 
      (delivery.synced_to_shopify === false && delivery.status !== 'pending' && delivery.status !== 'in_quality');

    // CORRECCIÓN: Verificar si la entrega está en estado de revisión (solo pending e in_quality)
    const isInReview = delivery.status === 'in_quality' || delivery.status === 'pending';
    
    // Las entregas aprobadas (approved) y parcialmente aprobadas (partial_approved) pueden sincronizarse
    const canBeSynced = delivery.status === 'approved' || delivery.status === 'partial_approved';
    
    // CORRECCIÓN: Items que están realmente sincronizados (solo contar los aprobados y sincronizados)
    const syncedApprovedItems = items.filter((item: any) => 
      item.quantity_approved > 0 && item.synced_to_shopify && !item.sync_error_message
    ).length;
    
    // CORRECCIÓN: Items que no necesitan sincronización (cantidad aprobada = 0 en entregas NO en revisión)
    const itemsNotNeedingSync = items.filter((item: any) => 
      item.quantity_approved === 0 && !isInReview
    ).length;
    
    // CORRECCIÓN: Una entrega está completamente sincronizada si:
    // 1. NO está en revisión Y
    // 2. Todos los items con cantidad aprobada > 0 están sincronizados Y
    // 3. Tiene al menos un item procesado Y
    // 4. NO hay errores a nivel de entrega
    const itemsNeedingSync = items.filter((item: any) => item.quantity_approved > 0);
    const isFullySynced = !isInReview && canBeSynced && 
      (itemsNeedingSync.length === 0 || syncedApprovedItems === itemsNeedingSync.length) &&
      totalItems > 0 && !hasDeliveryError && delivery.synced_to_shopify !== false;

    return {
      totalItems,
      syncedApprovedItems,
      itemsNotNeedingSync,
      itemsWithApprovedQty,
      failedItems,
      reviewedItems: reviewedItems.length,
      isFullySynced,
      isInReview,
      canBeSynced,
      hasFailures: failedItems > 0 || hasDeliveryError,
      hasDeliveryError,
      needsSync: itemsWithApprovedQty > 0 && syncedApprovedItems < itemsWithApprovedQty && canBeSynced && !hasDeliveryError
    };
  };

  const syncStats = getSyncStats();


  // Determinar estado visual - CORRECCIÓN: priorizar "En Revisión"
  const getSyncStatusInfo = () => {
    // PRIORIDAD 1: Si está en revisión, mostrar estado de revisión SIN IMPORTAR nada más
    if (syncStats.isInReview) {
      return {
        icon: Clock,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        text: size === 'sm' ? '' : 'En Revisión',
        variant: 'secondary' as const,
        showIcon: true
      };
    }

    // PRIORIDAD 2: Si tiene errores de sincronización
    if (syncStats.hasFailures) {
      return {
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-200',
        text: size === 'sm' ? '' : 'Error de Sync',
        variant: 'destructive' as const,
        showIcon: true
      };
    }

    // PRIORIDAD 3: Si necesita sincronización
    if (syncStats.needsSync) {
      return {
        icon: AlertTriangle,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        text: size === 'sm' ? '' : 'Pendiente Sync',
        variant: 'secondary' as const,
        showIcon: true
      };
    }

    // PRIORIDAD 4: Si está completamente sincronizado
    if (syncStats.isFullySynced) {
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        text: size === 'sm' ? '' : 'Sincronizado',
        variant: 'default' as const,
        showIcon: true
      };
    }

    // PRIORIDAD 5: Para entregas aprobadas/parciales sin items aprobados (solo defectuosos)
    if (syncStats.canBeSynced && syncStats.itemsWithApprovedQty === 0) {
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        text: size === 'sm' ? '' : 'Sincronizado',
        variant: 'default' as const,
        showIcon: true
      };
    }

    // PRIORIDAD 6: Sin items o estado indefinido
    return {
      icon: Info,
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      text: size === 'sm' ? '' : 'Sin Items',
      variant: 'outline' as const,
      showIcon: true
    };
  };

  const statusInfo = getSyncStatusInfo();
  const IconComponent = statusInfo.icon;

  // Función para reintentar sincronización
  const handleRetrySync = async () => {
    if (isRetrying) return;
    
    setIsRetrying(true);
    
    try {
      // First try to fix any status inconsistencies
      await resyncDeliveryStatus(delivery.id);
      
      // Get items that need to be synced (approved items that aren't synced yet)
      const itemsToSync = delivery.delivery_items
        ?.filter((item: any) => item.quantity_approved > 0 && !item.synced_to_shopify)
        ?.map((item: any) => ({
          variantId: item.order_items?.product_variants?.id,
          skuVariant: item.order_items?.product_variants?.sku_variant,
          quantityApproved: item.quantity_approved
        }))
        ?.filter((item: any) => item.variantId && item.skuVariant);

      if (!itemsToSync || itemsToSync.length === 0) {
        // Recalculate status and refresh
        if (onSyncSuccess) {
          onSyncSuccess();
        }
        
        toast({
          title: "Estado actualizado",
          description: "No hay elementos pendientes de sincronización. Estado corregido.",
        });
        return;
      }

      const syncData = {
        deliveryId: delivery.id,
        approvedItems: itemsToSync
      };

      await syncApprovedItemsToShopify(syncData);
      
      if (onSyncSuccess) {
        onSyncSuccess();
      }
      
      toast({
        title: "Sincronización completada",
        description: `Se sincronizaron ${itemsToSync.length} elementos exitosamente.`,
      });
    } catch (error: any) {
      console.error('Error en retry sync:', error);
      toast({
        title: "Error en sincronización",
        description: error.message || "Ocurrió un error durante la sincronización",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  // Obtener información detallada para tooltip - MEJORADA
  const getTooltipContent = () => {
    const details = [
      `Total items: ${syncStats.totalItems}`,
      `Items revisados: ${syncStats.reviewedItems}`,
      `Con cantidad aprobada: ${syncStats.itemsWithApprovedQty}`,
      `Items aprobados sincronizados: ${syncStats.syncedApprovedItems}`,
    ];

    if (syncStats.isInReview) {
      details.push(`Estado: En proceso de revisión de calidad`);
      details.push(`Nota: La sincronización se realizará tras la aprobación`);
    } else if (syncStats.canBeSynced) {
      details.push(`Estado: Puede sincronizarse`);
    }

    // CORRECCIÓN: Mostrar errores de entrega con prioridad
    if (delivery.sync_error_message) {
      details.push(`❌ Error de entrega: ${delivery.sync_error_message}`);
    }

    if (delivery.synced_to_shopify === false && !syncStats.isInReview) {
      details.push(`⚠️ Entrega no sincronizada con Shopify`);
    }

    if (syncStats.failedItems > 0) {
      details.push(`❌ Items con errores: ${syncStats.failedItems}`);
      
      // Mostrar errores específicos de items
      const itemErrors = delivery.delivery_items
        ?.filter((item: any) => item.quantity_approved > 0 && item.sync_error_message)
        ?.map((item: any) => `  • ${item.order_items?.product_variants?.sku_variant}: ${item.sync_error_message}`)
        ?.slice(0, 3); // Limitar a 3 errores para no sobrecargar el tooltip
      
      if (itemErrors && itemErrors.length > 0) {
        details.push(...itemErrors);
        if (syncStats.failedItems > 3) {
          details.push(`  • Y ${syncStats.failedItems - 3} errores más...`);
        }
      }
    }

    return details.join('\n');
  };

  const badgeSize = size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-sm px-3 py-2' : 'text-xs px-2 py-1';
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* Para tamaño sm, mostrar solo el ícono sin texto */}
            {size === 'sm' && statusInfo.text === '' ? (
              <div className={`${statusInfo.color} ${badgeSize} flex items-center justify-center rounded-full cursor-help`}>
                <IconComponent className={iconSize} />
              </div>
            ) : (
              <Badge 
                variant={statusInfo.variant}
                className={`${statusInfo.color} ${badgeSize} flex items-center gap-1 cursor-help`}
              >
                <IconComponent className={iconSize} />
                {statusInfo.text}
              </Badge>
            )}
          </TooltipTrigger>
          <TooltipContent>
            <pre className="text-xs whitespace-pre-wrap">{getTooltipContent()}</pre>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Botón de reintento para casos con error o pendientes */}
      {(syncStats.hasFailures || (syncStats.needsSync && syncStats.canBeSynced)) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRetrySync}
          disabled={loading || isRetrying}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className={`w-3 h-3 ${(loading || isRetrying) ? 'animate-spin' : ''}`} />
        </Button>
      )}

      {/* Detalles expandidos */}
      {showDetails && (
        <div className="ml-4 space-y-2">
          {syncStats.isInReview && (
            <Alert className="mt-2">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Esta entrega está en proceso de revisión de calidad. La sincronización se realizará automáticamente una vez aprobada.
              </AlertDescription>
            </Alert>
          )}
          
          {syncStats.hasFailures && (
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {delivery.sync_error_message ? (
                  <div>
                    <strong>Error de entrega:</strong> {delivery.sync_error_message}
                    {syncStats.failedItems > 0 && (
                      <div className="mt-1">
                        <strong>Items con problemas:</strong> {syncStats.failedItems}
                      </div>
                    )}
                  </div>
                ) : (
                  `${syncStats.failedItems} items con errores de sincronización`
                )}
              </AlertDescription>
            </Alert>
          )}

          {syncStats.needsSync && !syncStats.hasFailures && syncStats.canBeSynced && (
            <Alert className="mt-2">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Hay {syncStats.itemsWithApprovedQty - syncStats.syncedApprovedItems} items pendientes de sincronización
              </AlertDescription>
            </Alert>
          )}

          {syncStats.isFullySynced && (
            <Alert className="mt-2">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Todos los items están sincronizados correctamente
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliverySyncStatus;
