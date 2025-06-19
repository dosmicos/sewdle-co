
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Truck, Package, CheckCircle, XCircle, AlertTriangle, Calendar, Factory, ShirtIcon, RefreshCw } from 'lucide-react';
import { useOrderDeliveryStats } from '@/hooks/useOrderDeliveryStats';

interface OrderDeliveryTrackerProps {
  orderId: string;
  orderNumber: string;
}

const OrderDeliveryTracker: React.FC<OrderDeliveryTrackerProps> = ({ orderId, orderNumber }) => {
  const [stats, setStats] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { getOrderStats, getOrderDeliveriesBreakdown, getOrderVariantsBreakdown, loading } = useOrderDeliveryStats();

  useEffect(() => {
    loadData();
  }, [orderId]);

  const loadData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    }
    
    try {
      console.log('Loading order delivery data for order:', orderId, 'Force refresh:', forceRefresh);
      
      const [orderStats, deliveriesData, variantsData] = await Promise.all([
        getOrderStats(orderId),
        getOrderDeliveriesBreakdown(orderId),
        getOrderVariantsBreakdown(orderId)
      ]);
      
      console.log('Loaded order stats:', orderStats);
      console.log('Loaded deliveries data:', deliveriesData);
      console.log('Loaded variants data:', variantsData);
      
      setStats(orderStats);
      setDeliveries(deliveriesData);
      setVariants(variantsData);
    } catch (error) {
      console.error('Error loading order delivery data:', error);
    } finally {
      if (forceRefresh) {
        setRefreshing(false);
      }
    }
  };

  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    loadData(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'partial_approved':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_quality':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      case 'partial_approved':
        return 'Parcial';
      case 'in_quality':
        return 'En Calidad';
      case 'delivered':
        return 'Entregada';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-4"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Generales */}
      {stats && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Seguimiento de Entregas - {orderNumber}</span>
            </CardTitle>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={refreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refrescando...' : 'Refrescar'}</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.total_ordered}</div>
                <div className="text-sm text-blue-700">Total Ordenadas</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.total_delivered}</div>
                <div className="text-sm text-purple-700">Total Entregadas</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.total_approved}</div>
                <div className="text-sm text-green-700">Aprobadas</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.total_defective}</div>
                <div className="text-sm text-red-700">Defectuosas</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progreso de Completitud</span>
                  <span className="text-sm text-gray-600">{stats.completion_percentage}%</span>
                </div>
                <Progress value={stats.completion_percentage} className="mb-2" />
                <div className="text-xs text-gray-600">
                  {stats.total_approved} de {stats.total_ordered} unidades aprobadas
                </div>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.total_pending}</div>
                <div className="text-sm text-orange-700">Pendientes</div>
                <div className="text-xs text-gray-600 mt-1">
                  (Incluye devueltas por defectos)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desglose por Variantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShirtIcon className="w-5 h-5" />
            <span>Desglose por Variante ({variants.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {variants.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShirtIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay variantes registradas para esta orden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variante</TableHead>
                    <TableHead className="text-center">Ordenadas</TableHead>
                    <TableHead className="text-center">Aprobadas</TableHead>
                    <TableHead className="text-center">Pendientes</TableHead>
                    <TableHead className="text-center">Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.map((variant, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {variant.product_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{variant.variant_size}</span>
                          <span className="text-sm text-gray-600">{variant.variant_color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Package className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-blue-600">
                            {variant.total_ordered}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-600">
                            {variant.total_approved}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="font-medium text-orange-600">
                            {variant.total_pending}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center space-x-2">
                          <Progress value={variant.completion_percentage} className="w-16" />
                          <span className="text-xs text-gray-600 font-medium">
                            {variant.completion_percentage}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Desglose por Entregas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Truck className="w-5 h-5" />
            <span>Desglose por Entregas ({deliveries.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No hay entregas registradas para esta orden</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrega</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Entregadas</TableHead>
                    <TableHead className="text-center">Aprobadas</TableHead>
                    <TableHead className="text-center">Defectuosas</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.delivery_id}>
                      <TableCell className="font-medium">
                        {delivery.tracking_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{formatDate(delivery.delivery_date)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Factory className="w-4 h-4 text-gray-500" />
                          <span>{delivery.workshop_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(delivery.delivery_status)}>
                          {getStatusText(delivery.delivery_status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Package className="w-4 h-4 text-purple-500" />
                          <span className="font-medium text-purple-600">
                            {delivery.items_delivered}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-600">
                            {delivery.items_approved}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="font-medium text-red-600">
                            {delivery.items_defective}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {delivery.delivery_notes ? (
                          <div className="max-w-xs">
                            <p className="text-sm text-gray-600 truncate" title={delivery.delivery_notes}>
                              {delivery.delivery_notes}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Sin notas</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDeliveryTracker;
