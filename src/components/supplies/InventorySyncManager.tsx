import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, CheckCircle, AlertTriangle, Clock, Zap, Shield, X } from 'lucide-react';
import { useInventorySync } from '@/hooks/useInventorySync';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useToast } from '@/hooks/use-toast';
import { resyncDeliveryDEL0022 } from '@/utils/resyncDelivery';

interface InventorySyncManagerProps {
  deliveryId?: string;
}

const InventorySyncManager = ({ deliveryId }: InventorySyncManagerProps) => {
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);
  const [skuStatuses, setSkuStatuses] = useState<{[deliveryId: string]: any[]}>({});

  const { 
    syncApprovedItemsToShopify, 
    fetchSyncLogs, 
    checkRecentSuccessfulSync,
    checkSkuSyncStatus,
    loading: syncLoading 
  } = useInventorySync();
  const { fetchDeliveries, fetchDeliveryById, loading: deliveriesLoading } = useDeliveries();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, [deliveryId]);

  const loadData = async () => {
    const [logs, deliveries] = await Promise.all([
      fetchSyncLogs(deliveryId),
      fetchDeliveries()
    ]);

    setSyncLogs(logs);
    
    // Filtrar entregas aprobadas que necesitan sincronización
    const filteredDeliveries = [];
    const newSkuStatuses: {[deliveryId: string]: any[]} = {};
    
    for (const delivery of deliveries) {
      // Solo incluir entregas aprobadas con items pendientes
      if (!['approved', 'partial_approved'].includes(delivery.status) || delivery.total_approved <= 0) {
        continue;
      }
      
      // Verificar si hay sincronización exitosa reciente en los logs
      const hasRecentSync = await checkRecentSuccessfulSync(delivery.id);
      
      if (!hasRecentSync && !delivery.synced_to_shopify) {
        // Obtener detalles completos de la entrega para verificar SKUs
        const fullDelivery = await fetchDeliveryById(delivery.id);
        
        if (fullDelivery?.delivery_items) {
          const skuVariants = fullDelivery.delivery_items
            .filter((item: any) => item.quantity_approved > 0)
            .map((item: any) => item.order_items?.product_variants?.sku_variant)
            .filter(Boolean);
          
          if (skuVariants.length > 0) {
            // Verificar estado de cada SKU
            const skuStatuses = await checkSkuSyncStatus(delivery.id, skuVariants);
            newSkuStatuses[delivery.id] = skuStatuses;
            
            // Solo incluir si hay SKUs que necesitan sincronización
            const pendingSkus = skuStatuses.filter(s => s.needsSync);
            if (pendingSkus.length > 0) {
              filteredDeliveries.push({
                ...delivery,
                pendingSkusCount: pendingSkus.length,
                totalSkusCount: skuStatuses.length,
                syncedSkusCount: skuStatuses.length - pendingSkus.length
              });
            }
          }
        }
      }
    }
    
    setSkuStatuses(newSkuStatuses);
    setPendingDeliveries(filteredDeliveries);
  };

  const handleManualSync = async (delivery: any) => {
    try {
      // Verificar que no esté ya sincronizada
      if (delivery.synced_to_shopify) {
        toast({
          title: "Ya sincronizada",
          description: "Esta entrega ya fue sincronizada con Shopify",
          variant: "destructive",
        });
        return;
      }

      // Check if there's a recent successful sync for this delivery
      const hasRecentSync = await checkRecentSuccessfulSync(delivery.id);
      
      if (hasRecentSync) {
        toast({
          title: "Sincronización reciente detectada",
          description: `La entrega ${delivery.tracking_number} fue sincronizada exitosamente en los últimos 30 minutos.`,
          variant: "destructive",
        });
        return;
      }

      // Caso especial para DEL-0022 que necesita resincronización con SKUs actualizados
      if (delivery.tracking_number === 'DEL-0022') {
        console.log('Resyncing DEL-0022 with updated SKUs...');
        const result = await resyncDeliveryDEL0022();
        
        if (result.success) {
          toast({
            title: "DEL-0022 Resincronizada",
            description: `${result.summary.successful} productos actualizados con SKUs corregidos`,
          });
        } else {
          throw new Error(result.error || 'Error en resincronización de DEL-0022');
        }
        
        await loadData();
        return;
      }

      // Obtener detalles completos de la entrega
      const fullDelivery = await fetchDeliveryById(delivery.id);
      
      if (!fullDelivery || !fullDelivery.delivery_items) {
        throw new Error('No se pudieron obtener los detalles de la entrega');
      }

      // Mapear items aprobados para sincronización
      const approvedItems = fullDelivery.delivery_items
        .filter((item: any) => item.quantity_approved > 0)
        .map((item: any) => ({
          variantId: item.order_items?.product_variant_id || '',
          skuVariant: item.order_items?.product_variants?.sku_variant || '',
          quantityApproved: item.quantity_approved
        }))
        .filter((item: any) => item.skuVariant);

      if (approvedItems.length === 0) {
        throw new Error('No hay items aprobados para sincronizar');
      }

      await syncApprovedItemsToShopify({
        deliveryId: delivery.id,
        approvedItems
      }, true); // onlyPending = true para sincronización inteligente

      // Recargar datos después de la sincronización
      await loadData();

    } catch (error) {
      console.error('Error in manual sync:', error);
    }
  };

  const renderSyncStatus = (log: any) => {
    const successRate = log.success_count / (log.success_count + log.error_count) * 100;
    
    if (successRate === 100) {
      return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Exitoso</Badge>;
    } else if (successRate > 0) {
      return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />Parcial</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-700"><X className="w-3 h-3 mr-1" />Fallido</Badge>;
    }
  };

  const renderDeliveryStatus = (delivery: any) => {
    if (delivery.synced_to_shopify) {
      return <Badge className="bg-green-100 text-green-700"><Shield className="w-3 h-3 mr-1" />Sincronizado</Badge>;
    } else if (delivery.sync_attempts > 0) {
      return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />Error ({delivery.sync_attempts} intentos)</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
    }
  };

  const loading = syncLoading || deliveriesLoading;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>Sincronización de Inventario Shopify</span>
            </div>
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pending">Entregas Pendientes</TabsTrigger>
              <TabsTrigger value="logs">Historial de Sincronización</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Entregas Aprobadas Pendientes</h3>
                <Badge variant="outline">{pendingDeliveries.length} entregas</Badge>
              </div>
              
              {pendingDeliveries.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Todas las entregas están sincronizadas</h3>
                  <p className="text-gray-600">No hay entregas pendientes de sincronización con Shopify</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número de Seguimiento</TableHead>
                      <TableHead>Orden</TableHead>
                      <TableHead>SKUs</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado Sync</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingDeliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="font-medium">{delivery.tracking_number}</TableCell>
                        <TableCell>{delivery.order_number}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="border-blue-500 text-blue-700">
                              {delivery.pendingSkusCount || 0} pendientes
                            </Badge>
                            {delivery.syncedSkusCount > 0 && (
                              <Badge variant="outline" className="border-green-500 text-green-700">
                                {delivery.syncedSkusCount} sincronizados
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {delivery.status === 'approved' ? (
                            <Badge className="bg-green-100 text-green-700">Aprobado</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700">Parcial</Badge>
                          )}
                        </TableCell>
                        <TableCell>{new Date(delivery.delivery_date || delivery.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{renderDeliveryStatus(delivery)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              onClick={() => handleManualSync(delivery)}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600 text-white"
                              disabled={loading || delivery.synced_to_shopify}
                              title={`Sincronizar ${delivery.pendingSkusCount || 0} SKUs pendientes`}
                            >
                              <Zap className="w-4 h-4 mr-1" />
                              Sincronizar Pendientes
                            </Button>
                            {delivery.syncedSkusCount > 0 && (
                              <span className="text-xs text-gray-500">
                                {delivery.syncedSkusCount} ya sincronizados
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Historial de Sincronizaciones</h3>
                <Badge variant="outline">{syncLogs.length} registros</Badge>
              </div>

              {syncLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay sincronizaciones</h3>
                  <p className="text-gray-600">El historial de sincronizaciones aparecerá aquí</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Exitosos</TableHead>
                      <TableHead>Fallidos</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.delivery_id}</TableCell>
                        <TableCell>{renderSyncStatus(log)}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-700">
                            {log.success_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.error_count > 0 ? (
                            <Badge className="bg-red-100 text-red-700">
                              {log.error_count}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(log.synced_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventorySyncManager;
