import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Package, 
  ShoppingCart,
  Clock,
  XCircle,
  Loader2
} from 'lucide-react';

interface DeliveryWithSyncStatus {
  id: string;
  tracking_number: string;
  order_number: string;
  workshop_name: string;
  delivery_date: string;
  status: string;
  synced_to_shopify: boolean;
  sync_attempts: number;
  last_sync_attempt: string | null;
  sync_error_message: string | null;
  total_approved: number;
  items_count: number;
}

interface DeliveryItem {
  id: string;
  quantity_approved: number;
  quantity_defective: number;
  synced_to_shopify: boolean;
  sync_error_message: string | null;
  product_name: string;
  sku_variant: string;
}

export const ShopifySyncDiagnostics: React.FC = () => {
  const [deliveries, setDeliveries] = useState<DeliveryWithSyncStatus[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resyncLoading, setResyncLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDeliveriesWithSyncStatus();
  }, []);

  const loadDeliveriesWithSyncStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id,
          tracking_number,
          synced_to_shopify,
          sync_attempts,
          last_sync_attempt,
          sync_error_message,
          delivery_date,
          status,
          orders (order_number),
          workshops (name),
          delivery_items (
            quantity_approved,
            quantity_defective
          )
        `)
        .in('status', ['approved', 'partial_approved'])
        .order('last_sync_attempt', { ascending: false });

      if (error) throw error;

      const formattedDeliveries = data.map((delivery: any) => ({
        id: delivery.id,
        tracking_number: delivery.tracking_number,
        order_number: delivery.orders?.order_number || 'N/A',
        workshop_name: delivery.workshops?.name || 'N/A',
        delivery_date: delivery.delivery_date,
        status: delivery.status,
        synced_to_shopify: delivery.synced_to_shopify,
        sync_attempts: delivery.sync_attempts || 0,
        last_sync_attempt: delivery.last_sync_attempt,
        sync_error_message: delivery.sync_error_message,
        total_approved: delivery.delivery_items?.reduce((sum: number, item: any) => 
          sum + (item.quantity_approved || 0), 0) || 0,
        items_count: delivery.delivery_items?.length || 0
      }));

      setDeliveries(formattedDeliveries);
    } catch (error) {
      console.error('Error loading deliveries:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las entregas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDeliveryItems = async (deliveryId: string) => {
    try {
      const { data, error } = await supabase
        .from('delivery_items')
        .select(`
          id,
          quantity_approved,
          quantity_defective,
          synced_to_shopify,
          sync_error_message,
          order_items (
            product_variants (
              sku_variant,
              products (name)
            )
          )
        `)
        .eq('delivery_id', deliveryId);

      if (error) throw error;

      const formattedItems = data.map((item: any) => ({
        id: item.id,
        quantity_approved: item.quantity_approved || 0,
        quantity_defective: item.quantity_defective || 0,
        synced_to_shopify: item.synced_to_shopify,
        sync_error_message: item.sync_error_message,
        product_name: item.order_items?.product_variants?.products?.name || 'N/A',
        sku_variant: item.order_items?.product_variants?.sku_variant || 'N/A'
      }));

      setDeliveryItems(formattedItems);
    } catch (error) {
      console.error('Error loading delivery items:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los items de la entrega",
        variant: "destructive",
      });
    }
  };

  const handleResyncDelivery = async (deliveryId: string, options: {
    specificSkus?: string[];
    retryAll?: boolean;
  } = {}) => {
    try {
      setResyncLoading(deliveryId);
      
      const { data, error } = await supabase.functions.invoke('resync-delivery', {
        body: {
          deliveryId,
          ...options
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Éxito",
          description: data.message,
        });
        
        // Recargar datos
        await loadDeliveriesWithSyncStatus();
        if (selectedDelivery === deliveryId) {
          await loadDeliveryItems(deliveryId);
        }
      } else {
        throw new Error(data.error || 'Error en resincronización');
      }
    } catch (error) {
      console.error('Error en resincronización:', error);
      toast({
        title: "Error en resincronización",
        description: error instanceof Error ? error.message : "No se pudo resincronizar la entrega",
        variant: "destructive",
      });
    } finally {
      setResyncLoading(null);
    }
  };

  const handleResyncFailedItems = async (deliveryId: string) => {
    const failedSkus = deliveryItems
      .filter(item => !item.synced_to_shopify || item.sync_error_message)
      .map(item => item.sku_variant);
    
    if (failedSkus.length === 0) {
      toast({
        title: "Sin items para resincronizar",
        description: "No hay items fallidos en esta entrega",
      });
      return;
    }

    await handleResyncDelivery(deliveryId, { specificSkus: failedSkus });
  };

  const getSyncStatusBadge = (delivery: DeliveryWithSyncStatus) => {
    if (delivery.synced_to_shopify && !delivery.sync_error_message) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Sincronizado</Badge>;
    }
    
    if (delivery.sync_error_message) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
    }
    
    if (delivery.sync_attempts > 0) {
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Parcial</Badge>;
    }
    
    return <Badge variant="outline"><Package className="w-3 h-3 mr-1" />Pendiente</Badge>;
  };

  const getItemSyncStatus = (item: DeliveryItem) => {
    if (item.synced_to_shopify && !item.sync_error_message) {
      return <Badge variant="default" className="bg-green-100 text-green-800">✓</Badge>;
    }
    
    if (item.sync_error_message) {
      return <Badge variant="destructive">✗</Badge>;
    }
    
    return <Badge variant="outline">⏳</Badge>;
  };

  // Filtrar entregas con problemas
  const problematicDeliveries = deliveries.filter(d => 
    !d.synced_to_shopify || d.sync_error_message || d.sync_attempts === 0
  );

  const syncedDeliveries = deliveries.filter(d => 
    d.synced_to_shopify && !d.sync_error_message
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Cargando diagnóstico de sincronización...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Diagnóstico de Sincronización con Shopify
          </CardTitle>
          <CardDescription>
            Monitorea y corrige problemas de sincronización de inventario con Shopify
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Entregas con Problemas</p>
                  <p className="text-2xl font-bold text-red-700">{problematicDeliveries.length}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Sincronizadas</p>
                  <p className="text-2xl font-bold text-green-700">{syncedDeliveries.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Total Entregas</p>
                  <p className="text-2xl font-bold text-blue-700">{deliveries.length}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>

          <Button 
            onClick={loadDeliveriesWithSyncStatus}
            variant="outline"
            className="mb-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar Estado
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="problematic" className="w-full">
        <TabsList>
          <TabsTrigger value="problematic">
            Entregas con Problemas ({problematicDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Todas las Entregas ({deliveries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="problematic">
          {problematicDeliveries.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-700">Entregas que Requieren Atención</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrega</TableHead>
                      <TableHead>Orden</TableHead>
                      <TableHead>Taller</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Items Aprobados</TableHead>
                      <TableHead>Intentos</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {problematicDeliveries.map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="font-medium">{delivery.tracking_number}</TableCell>
                        <TableCell>{delivery.order_number}</TableCell>
                        <TableCell>{delivery.workshop_name}</TableCell>
                        <TableCell>{delivery.delivery_date}</TableCell>
                        <TableCell>{getSyncStatusBadge(delivery)}</TableCell>
                        <TableCell>{delivery.total_approved}</TableCell>
                        <TableCell>{delivery.sync_attempts}</TableCell>
                        <TableCell className="max-w-xs">
                          {delivery.sync_error_message && (
                            <div className="text-xs text-red-600 truncate" title={delivery.sync_error_message}>
                              {delivery.sync_error_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedDelivery(delivery.id);
                                loadDeliveryItems(delivery.id);
                              }}
                            >
                              Ver Detalle
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleResyncDelivery(delivery.id)}
                              disabled={resyncLoading === delivery.id}
                            >
                              {resyncLoading === delivery.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>¡Excelente!</AlertTitle>
              <AlertDescription>
                No hay entregas con problemas de sincronización en este momento.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Todas las Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Orden</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado Shopify</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Último Intento</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">{delivery.tracking_number}</TableCell>
                      <TableCell>{delivery.order_number}</TableCell>
                      <TableCell>{delivery.workshop_name}</TableCell>
                      <TableCell>{delivery.delivery_date}</TableCell>
                      <TableCell>{getSyncStatusBadge(delivery)}</TableCell>
                      <TableCell>{delivery.total_approved} aprobados</TableCell>
                      <TableCell>
                        {delivery.last_sync_attempt 
                          ? new Date(delivery.last_sync_attempt).toLocaleString()
                          : 'Nunca'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedDelivery(delivery.id);
                            loadDeliveryItems(delivery.id);
                          }}
                        >
                          Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detalle de items de entrega */}
      {selectedDelivery && (
        <Card>
          <CardHeader>
            <CardTitle>
              Detalle de Items - {deliveries.find(d => d.id === selectedDelivery)?.tracking_number}
            </CardTitle>
            <CardDescription>
              Estado de sincronización por producto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Button
                onClick={() => handleResyncFailedItems(selectedDelivery)}
                disabled={resyncLoading === selectedDelivery}
                variant="outline"
              >
                {resyncLoading === selectedDelivery ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Resincronizar Solo Fallidos
              </Button>
              <Button
                onClick={() => handleResyncDelivery(selectedDelivery, { retryAll: true })}
                disabled={resyncLoading === selectedDelivery}
              >
                Resincronizar Todos
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedDelivery(null)}
              >
                Cerrar
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Aprobados</TableHead>
                  <TableHead>Defectuosos</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveryItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{getItemSyncStatus(item)}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.sku_variant}</TableCell>
                    <TableCell>{item.quantity_approved}</TableCell>
                    <TableCell>{item.quantity_defective}</TableCell>
                    <TableCell className="max-w-xs">
                      {item.sync_error_message && (
                        <div className="text-xs text-red-600 truncate" title={item.sync_error_message}>
                          {item.sync_error_message}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};