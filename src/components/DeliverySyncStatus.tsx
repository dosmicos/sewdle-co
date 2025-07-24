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
    
    const syncedItems = items.filter((item: any) => 
      item.synced_to_shopify || item.quantity_approved === 0
    ).length;
    
    const itemsWithApprovedQty = items.filter((item: any) => 
      item.quantity_approved > 0
    ).length;
    
    const failedItems = items.filter((item: any) => 
      item.quantity_approved > 0 && !item.synced_to_shopify && item.sync_error_message
    ).length;

    // Verificar si la entrega está en estado de revisión (solo pending e in_quality)
    const isInReview = delivery.status === 'in_quality' || delivery.status === 'pending';
    
    // Las entregas aprobadas (approved) y parcialmente aprobadas (partial_approved) pueden sincronizarse
    const canBeSynced = delivery.status === 'approved' || delivery.status === 'partial_approved';
    
    // Una entrega está completamente sincronizada si:
    // 1. No está en revisión Y
    // 2. Todos los items con cantidad aprobada > 0 están sincronizados Y
    // 3. Tiene al menos un item procesado
    const itemsNeedingSync = items.filter((item: any) => item.quantity_approved > 0);
    const syncedApprovedItems = itemsNeedingSync.filter((item: any) => item.synced_to_shopify);
    const isFullySynced = !isInReview && canBeSynced && 
      (itemsNeedingSync.length === 0 || syncedApprovedItems.length === itemsNeedingSync.length) &&
      totalItems > 0;

    return {
      totalItems,
      syncedItems,
      itemsWithApprovedQty,
      failedItems,
      reviewedItems: reviewedItems.length,
      isFullySynced,
      isInReview,
      canBeSynced,
      hasFailures: failedItems > 0,
      needsSync: itemsWithApprovedQty > 0 && syncedItems < totalItems && canBeSynced
    };
  };

  const syncStats = getSyncStats();

  // Determinar estado visual
  const getSyncStatusInfo = () => {
    // Si está en revisión, mostrar estado de revisión
    if (syncStats.isInReview) {
      return {
        icon: Clock,
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        text: size === 'sm' ? '' : 'En Revisión',
        variant: 'secondary' as const,
        showIcon: true
      };
    }

    if (syncStats.isFullySynced) {
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        text: size === 'sm' ? '' : 'Sincronizado',
        variant: 'default' as const,
        showIcon: true
      };
    }

    if (syncStats.hasFailures) {
      return {
        icon: XCircle,
        color: 'bg-red-100 text-red-800 border-red-200',
        text: size === 'sm' ? '' : 'Error de Sync',
        variant: 'destructive' as const,
        showIcon: true
      };
    }

    if (syncStats.needsSync) {
      return {
        icon: AlertTriangle,
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        text: size === 'sm' ? '' : 'Pendiente Sync',
        variant: 'secondary' as const,
        showIcon: true
      };
    }

    // Para entregas aprobadas/parciales sin items aprobados (solo defectuosos)
    if (syncStats.canBeSynced && syncStats.itemsWithApprovedQty === 0) {
      return {
        icon: CheckCircle,
        color: 'bg-green-100 text-green-800 border-green-200',
        text: size === 'sm' ? '' : 'Sincronizado',
        variant: 'default' as const,
        showIcon: true
      };
    }

    if (syncStats.itemsWithApprovedQty === 0 && !syncStats.canBeSynced) {
      return {
        icon: Info,
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        text: size === 'sm' ? '' : 'Sin Items',
        variant: 'outline' as const,
        showIcon: true
      };
    }

    return {
      icon: Clock,
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      text: size === 'sm' ? '' : 'Pendiente',
      variant: 'outline' as const,
      showIcon: true
    };
  };

  const statusInfo = getSyncStatusInfo();
  const IconComponent = statusInfo.icon;

  // Función para reintentar sincronización
  const handleRetrySync = async () => {
    if (syncStats.itemsWithApprovedQty === 0) {
      toast({
        title: "Sin elementos para sincronizar",
        description: "No hay items con cantidad aprobada mayor a 0 para sincronizar",
        variant: "default"
      });
      return;
    }

    setIsRetrying(true);
    try {
      const approvedItems = delivery.delivery_items
        ?.filter((item: any) => item.quantity_approved > 0 && !item.synced_to_shopify)
        ?.map((item: any) => ({
          variantId: item.order_items?.product_variants?.id,
          skuVariant: item.order_items?.product_variants?.sku_variant,
          quantityApproved: item.quantity_approved
        })) || [];

      if (approvedItems.length === 0) {
        toast({
          title: "Ya sincronizado",
          description: "Todos los items aprobados ya están sincronizados",
          variant: "default"
        });
        return;
      }

      const syncData = {
        deliveryId: delivery.id,
        approvedItems
      };

      const result = await syncApprovedItemsToShopify(syncData);

      if (result.success && onSyncSuccess) {
        onSyncSuccess();
      }
    } catch (error) {
      console.error('Error retrying sync:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Obtener información detallada para tooltip
  const getTooltipContent = () => {
    const details = [
      `Total items: ${syncStats.totalItems}`,
      `Items revisados: ${syncStats.reviewedItems}`,
      `Sincronizados: ${syncStats.syncedItems}`,
      `Con cantidad aprobada: ${syncStats.itemsWithApprovedQty}`,
    ];

    if (syncStats.isInReview) {
      details.push(`Estado: En proceso de revisión de calidad`);
    }

    if (syncStats.failedItems > 0) {
      details.push(`Con errores: ${syncStats.failedItems}`);
    }

    if (delivery.sync_error_message) {
      details.push(`Error: ${delivery.sync_error_message}`);
    }

    if (delivery.last_sync_attempt) {
      const lastAttempt = new Date(delivery.last_sync_attempt).toLocaleString();
      details.push(`Último intento: ${lastAttempt}`);
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
        <div className="ml-4">
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
                {delivery.sync_error_message || 'Error de sincronización detectado'}
                {delivery.last_sync_attempt && (
                  <div className="text-xs mt-1 opacity-75">
                    Último intento: {new Date(delivery.last_sync_attempt).toLocaleString()}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {syncStats.needsSync && !syncStats.hasFailures && syncStats.canBeSynced && (
            <Alert className="mt-2">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Hay {syncStats.itemsWithApprovedQty - (syncStats.syncedItems - (syncStats.totalItems - syncStats.itemsWithApprovedQty))} items pendientes de sincronización
              </AlertDescription>
            </Alert>
          )}

          {syncStats.isFullySynced && (
            <Alert className="mt-2">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Todos los items están sincronizados correctamente
                {delivery.last_sync_attempt && (
                  <div className="text-xs mt-1 opacity-75">
                    Última sincronización: {new Date(delivery.last_sync_attempt).toLocaleString()}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliverySyncStatus;