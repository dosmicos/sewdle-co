
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Search, Package, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import InventoryDuplicationFixer from './InventoryDuplicationFixer';

interface SyncLogItem {
  sku: string;
  skuVariant?: string; // Add skuVariant as optional property for backward compatibility
  status: 'success' | 'error';
  error?: string;
  quantityAttempted?: number;
  productTitle?: string;
  addedQuantity?: number;
  newQuantity?: number;
  previousQuantity?: number;
}

// New sync results structure
interface SyncResultsObject {
  results: SyncLogItem[];
  intelligent_sync?: boolean;
  skipped_items?: unknown[];
  total_items_sent?: number;
  items_processed?: number;
}

// Type that can handle both old and new formats
type SyncResults = SyncLogItem[] | SyncResultsObject;

interface DeliverySyncInfo {
  id: string;
  tracking_number: string;
  synced_to_shopify: boolean;
  sync_attempts: number;
  last_sync_attempt: string | null;
  sync_error_message: string | null;
  sync_logs: {
    id: string;
    synced_at: string;
    success_count: number;
    error_count: number;
    sync_results: SyncResults; // Updated type
  }[];
}

const ShopifySyncDiagnostics = () => {
  const [deliveries, setDeliveries] = useState<DeliverySyncInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resyncing, setResyncing] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSyncData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Obtener entregas con logs de sincronización
      const { data: syncLogs, error } = await supabase
        .from('inventory_sync_logs')
        .select(`
          id,
          delivery_id,
          synced_at,
          success_count,
          error_count,
          sync_results
        `)
        .order('synced_at', { ascending: false });

      if (error) throw error;

      // Obtener información de entregas por separado con los campos correctos
      const deliveryIds = [...new Set(syncLogs?.map(log => log.delivery_id))];
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('id, tracking_number, synced_to_shopify, sync_attempts, last_sync_attempt, sync_error_message')
        .in('id', deliveryIds);

      if (deliveriesError) throw deliveriesError;

      // Crear mapa de entregas
      const deliveriesMap = new Map(deliveriesData?.map(d => [d.id, d]) || []);

      // Agrupar por entrega
      const deliveryMap = new Map<string, DeliverySyncInfo>();
      
      syncLogs?.forEach(log => {
        const deliveryId = log.delivery_id;
        const delivery = deliveriesMap.get(deliveryId);
        
        if (!delivery) return;
        
        if (!deliveryMap.has(deliveryId)) {
          deliveryMap.set(deliveryId, {
            id: deliveryId,
            tracking_number: delivery.tracking_number,
            synced_to_shopify: delivery.synced_to_shopify,
            sync_attempts: delivery.sync_attempts,
            last_sync_attempt: delivery.last_sync_attempt,
            sync_error_message: delivery.sync_error_message,
            sync_logs: []
          });
        }
        
        deliveryMap.get(deliveryId)?.sync_logs.push({
          id: log.id,
          synced_at: log.synced_at,
          success_count: log.success_count,
          error_count: log.error_count,
          sync_results: (log.sync_results as unknown[]) || []
        });
      });

      setDeliveries(Array.from(deliveryMap.values()));
    } catch (error) {
      console.error('Error loading sync data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de sincronización",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const resyncDelivery = async (deliveryId: string, trackingNumber: string, failedSkus?: string[]) => {
    try {
      setResyncing(deliveryId);
      
      const { data, error } = await supabase.functions.invoke('resync-delivery', {
        body: {
          deliveryId,
          failedSkusOnly: failedSkus ? failedSkus : undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Re-sincronización exitosa",
        description: `Entrega ${trackingNumber} re-sincronizada: ${data.summary?.successful || 0} productos actualizados`,
      });

      // Recargar datos
      await loadSyncData();
    } catch (error) {
      console.error('Error resyncing:', error);
      toast({
        title: "Error en re-sincronización",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setResyncing(null);
    }
  };

  useEffect(() => {
    loadSyncData();
  }, [loadSyncData]);

  const filteredDeliveries = deliveries.filter(delivery =>
    delivery.tracking_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (delivery: DeliverySyncInfo) => {
    // Verificar si está sincronizando (último intento fue hace menos de 5 minutos)
    const now = new Date();
    const lastAttempt = delivery.last_sync_attempt ? new Date(delivery.last_sync_attempt) : null;
    const isRecentAttempt = lastAttempt && (now.getTime() - lastAttempt.getTime()) < 5 * 60 * 1000; // 5 minutos

    if (isRecentAttempt && delivery.sync_attempts > 0 && !delivery.synced_to_shopify) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Sincronizando
        </Badge>
      );
    }

    // Si hay mensaje de error reciente
    if (delivery.sync_error_message) {
      const latestLog = delivery.sync_logs[0];
      const errorCount = latestLog?.error_count || 0;
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          {errorCount} errores
        </Badge>
      );
    }

    // Si está sincronizada
    if (delivery.synced_to_shopify) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3" />
          Sincronizada
        </Badge>
      );
    }

    // Estado por defecto
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Pendiente
      </Badge>
    );
  };

  const getFailedSkus = (delivery: DeliverySyncInfo): string[] => {
    const latestLog = delivery.sync_logs[0];
    if (!latestLog || !latestLog.sync_results) return [];

    // Handle both old and new sync_results structure for backward compatibility
    let results: SyncLogItem[] = [];
    
    // New structure: sync_results.results contains the array
    if (typeof latestLog.sync_results === 'object' && !Array.isArray(latestLog.sync_results)) {
      const syncResultsObj = latestLog.sync_results as SyncResultsObject;
      if (syncResultsObj.results && Array.isArray(syncResultsObj.results)) {
        results = syncResultsObj.results;
      }
    }
    // Old structure: sync_results is directly an array
    else if (Array.isArray(latestLog.sync_results)) {
      results = latestLog.sync_results as SyncLogItem[];
    }

    return results
      .filter(item => item.status === 'error')
      .map(item => item.sku || item.skuVariant || '');
  };

  const getSyncCount = (delivery: DeliverySyncInfo): number => {
    return delivery.sync_logs.length;
  };

  const hasDuplicatedSyncs = (delivery: DeliverySyncInfo): boolean => {
    const successfulSyncs = delivery.sync_logs.filter(log => log.success_count > 0);
    return successfulSyncs.length > 1;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="diagnostics" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="diagnostics" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Diagnóstico de Sincronización
          </TabsTrigger>
          <TabsTrigger value="duplications" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Corrector de Duplicaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnostics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Diagnóstico de Sincronización Shopify
              </CardTitle>
              <CardDescription>
                Revisa y corrige problemas de sincronización de inventario con Shopify
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por número de entrega..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={loadSyncData} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar
                  </Button>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entrega</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Sincronizaciones</TableHead>
                        <TableHead>Última Sincronización</TableHead>
                        <TableHead>Éxitos / Errores</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeliveries.map((delivery) => {
                        const latestLog = delivery.sync_logs[0];
                        const failedSkus = getFailedSkus(delivery);
                        const syncCount = getSyncCount(delivery);
                        const hasDuplicates = hasDuplicatedSyncs(delivery);
                        
                        return (
                          <TableRow key={delivery.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {delivery.tracking_number}
                                {hasDuplicates && (
                                  <Badge variant="secondary" className="text-xs">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Duplicada
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(delivery)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={syncCount > 1 ? "destructive" : "default"}>
                                {syncCount}x
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {latestLog ? new Date(latestLog.synced_at).toLocaleString('es-ES') : '-'}
                            </TableCell>
                            <TableCell>
                              {latestLog ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-green-600">{latestLog.success_count}</span>
                                  <span>/</span>
                                  <span className="text-red-600">{latestLog.error_count}</span>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {failedSkus.length > 0 ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => resyncDelivery(delivery.id, delivery.tracking_number, failedSkus)}
                                  disabled={resyncing === delivery.id}
                                >
                                  {resyncing === delivery.id ? (
                                    <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                  )}
                                  Corregir Errores ({failedSkus.length})
                                </Button>
                              ) : (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  Sin errores
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Detalles de errores expandibles */}
                {filteredDeliveries.map((delivery) => {
                  const latestLog = delivery.sync_logs[0];
                  
                  // Handle both old and new sync_results structure for backward compatibility
                  let results: SyncLogItem[] = [];
                  if (latestLog?.sync_results) {
                    // New structure: sync_results.results contains the array
                    if (typeof latestLog.sync_results === 'object' && !Array.isArray(latestLog.sync_results)) {
                      const syncResultsObj = latestLog.sync_results as SyncResultsObject;
                      if (syncResultsObj.results && Array.isArray(syncResultsObj.results)) {
                        results = syncResultsObj.results;
                      }
                    }
                    // Old structure: sync_results is directly an array
                    else if (Array.isArray(latestLog.sync_results)) {
                      results = latestLog.sync_results as SyncLogItem[];
                    }
                  }
                  
                  const errorItems = results.filter(item => item.status === 'error') || [];
                  
                  if (errorItems.length === 0) return null;

                  return (
                    <Card key={`${delivery.id}-details`} className="mt-4">
                      <CardHeader>
                        <CardTitle className="text-lg">Errores en {delivery.tracking_number}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {errorItems.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium">SKU: {item.sku}</div>
                                {item.productTitle && (
                                  <div className="text-sm text-gray-600">{item.productTitle}</div>
                                )}
                                <div className="text-sm text-red-600">
                                  Error: {item.error}
                                </div>
                                {item.quantityAttempted && (
                                  <div className="text-sm text-gray-500">
                                    Cantidad intentada: {item.quantityAttempted}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="duplications">
          <InventoryDuplicationFixer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShopifySyncDiagnostics;
