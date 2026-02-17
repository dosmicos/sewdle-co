
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Package, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DuplicationIssue {
  deliveryId: string;
  trackingNumber: string;
  syncCount: number;
  totalDuplicatedQuantity: number;
  items: {
    sku: string;
    duplicatedQuantity: number;
    syncLogs: unknown[];
  }[];
}

const InventoryDuplicationFixer = () => {
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [duplications, setDuplications] = useState<DuplicationIssue[]>([]);
  const { toast } = useToast();

  // Helper function to normalize sync_results to always return an array
  const normalizeSyncResults = (rawSyncResults: unknown): unknown[] => {
    if (!rawSyncResults) return [];
    
    // New format: sync_results is an object with results property
    if (typeof rawSyncResults === 'object' && !Array.isArray(rawSyncResults)) {
      if (rawSyncResults.results && Array.isArray(rawSyncResults.results)) {
        return rawSyncResults.results;
      }
      return [];
    }
    
    // Old format: sync_results is directly an array
    if (Array.isArray(rawSyncResults)) {
      return rawSyncResults;
    }
    
    return [];
  };

  const detectDuplications = async (specificTracking?: string) => {
    setLoading(true);
    try {
      // Primero obtener todos los logs de sincronización
      const syncLogsQuery = supabase
        .from('inventory_sync_logs')
        .select('*')
        .order('synced_at', { ascending: false });

      const { data: allLogs, error: logsError } = await syncLogsQuery;

      if (logsError) throw logsError;

      // Luego obtener información de las entregas
      let deliveriesQuery = supabase
        .from('deliveries')
        .select('id, tracking_number');

      if (specificTracking) {
        deliveriesQuery = deliveriesQuery.eq('tracking_number', specificTracking);
      }

      const { data: deliveries, error: deliveriesError } = await deliveriesQuery;

      if (deliveriesError) throw deliveriesError;

      // Crear mapa de entregas para búsqueda rápida
      const deliveriesMap = new Map(deliveries?.map(d => [d.id, d.tracking_number]) || []);

      // Filtrar logs por entrega específica si se proporcionó
      let filteredLogs = allLogs || [];
      if (specificTracking) {
        const targetDelivery = deliveries?.find(d => d.tracking_number === specificTracking);
        if (targetDelivery) {
          filteredLogs = allLogs?.filter(log => log.delivery_id === targetDelivery.id) || [];
        } else {
          toast({
            title: "Error",
            description: "No se encontró la entrega especificada",
            variant: "destructive",
          });
          return;
        }
      }

      // Agrupar por delivery_id y analizar duplicaciones
      const deliveryGroups = new Map<string, unknown[]>();
      
      filteredLogs.forEach(log => {
        const deliveryId = log.delivery_id;
        if (!deliveryGroups.has(deliveryId)) {
          deliveryGroups.set(deliveryId, []);
        }
        deliveryGroups.get(deliveryId)!.push(log);
      });

      const detectedDuplications: DuplicationIssue[] = [];

      for (const [deliveryId, deliveryLogs] of deliveryGroups) {
        const trackingNumber = deliveriesMap.get(deliveryId) || 'Unknown';
        
        // Buscar duplicaciones por SKU
        const skuSyncCount = new Map<string, { count: number, totalQuantity: number, logs: unknown[] }>();
        
        deliveryLogs.forEach(log => {
          const syncResults = normalizeSyncResults(log.sync_results);
          syncResults.forEach((result: unknown) => {
            const addedQuantity = Number(result.addedQuantity ?? 0);
            if (result.status === 'success' && addedQuantity > 0) {
              const sku = result.sku || result.skuVariant || '';
              if (sku && !skuSyncCount.has(sku)) {
                skuSyncCount.set(sku, { count: 0, totalQuantity: 0, logs: [] });
              }
              if (sku) {
                const skuData = skuSyncCount.get(sku)!;
                skuData.count++;
                skuData.totalQuantity += addedQuantity;
                skuData.logs.push({
                  synced_at: log.synced_at,
                  quantity: addedQuantity,
                  method: result.method
                });
              }
            }
          });
        });

        // Detectar duplicaciones (más de 1 sincronización exitosa)
        const duplicatedItems = [];
        let totalDuplicatedQuantity = 0;

        for (const [sku, data] of skuSyncCount) {
          if (data.count > 1) {
            const duplicatedQuantity = data.totalQuantity - (data.totalQuantity / data.count);
            duplicatedItems.push({
              sku,
              duplicatedQuantity,
              syncLogs: data.logs
            });
            totalDuplicatedQuantity += duplicatedQuantity;
          }
        }

        if (duplicatedItems.length > 0) {
          detectedDuplications.push({
            deliveryId,
            trackingNumber,
            syncCount: deliveryLogs.length,
            totalDuplicatedQuantity,
            items: duplicatedItems
          });
        }
      }

      setDuplications(detectedDuplications);
      
      toast({
        title: "Análisis completado",
        description: `Se detectaron ${detectedDuplications.length} entregas con duplicaciones`,
      });

    } catch (error) {
      console.error('Error detecting duplications:', error);
      toast({
        title: "Error",
        description: "No se pudo analizar las duplicaciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fixDuplication = async (duplication: DuplicationIssue) => {
    setFixing(true);
    try {
      // Crear función edge para corregir duplicaciones
      const { data, error } = await supabase.functions.invoke('fix-inventory-duplication', {
        body: {
          deliveryId: duplication.deliveryId,
          duplicatedItems: duplication.items
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Duplicación corregida",
          description: `Se corrigieron ${data.correctedItems} items duplicados`,
        });
        
        // Actualizar la lista
        await detectDuplications();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }

    } catch (error) {
      console.error('Error fixing duplication:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo corregir la duplicación",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Corrector de Duplicaciones de Inventario
          </CardTitle>
          <CardDescription>
            Detecta y corrige duplicaciones en el inventario de Shopify causadas por sincronizaciones múltiples
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Input
                placeholder="Número de entrega (opcional)"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={() => detectDuplications(trackingNumber || undefined)}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mr-2" />
                )}
                Detectar Duplicaciones
              </Button>
            </div>

            {duplications.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se encontraron {duplications.length} entregas con duplicaciones de inventario.
                  Estas duplicaciones han causado que el inventario en Shopify sea mayor al esperado.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {duplications.map((duplication) => (
                <Card key={duplication.deliveryId} className="border-orange-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{duplication.trackingNumber}</CardTitle>
                        <CardDescription>
                          Sincronizada {duplication.syncCount} veces | 
                          Total duplicado: {duplication.totalDuplicatedQuantity} unidades
                        </CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => fixDuplication(duplication)}
                        disabled={fixing}
                      >
                        {fixing ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Minus className="w-4 h-4 mr-2" />
                        )}
                        Corregir Duplicación
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {duplication.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">SKU: {item.sku}</div>
                            <div className="text-sm text-orange-600">
                              Duplicado: {item.duplicatedQuantity} unidades
                            </div>
                            <div className="text-sm text-gray-500">
                              Sincronizaciones: {item.syncLogs.length}
                            </div>
                          </div>
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            Duplicado
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryDuplicationFixer;
