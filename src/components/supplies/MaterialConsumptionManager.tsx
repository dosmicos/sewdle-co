import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';
import MaterialConsumptionForm from './MaterialConsumptionForm';

const MaterialConsumptionManager = () => {
  const [filters, setFilters] = useState({
    workshop: 'all',
    status: 'all'
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showConsumptionForm, setShowConsumptionForm] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);

  const { fetchOrders, loading: ordersLoading } = useOrders();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { fetchMaterialDeliveries } = useMaterialDeliveries();
  const { loading: consumptionLoading } = useMaterialConsumption();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadOrders(),
      loadConsumptionHistory()
    ]);
  };

  const loadOrders = async () => {
    try {
      const ordersData = await fetchOrders();
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    }
  };

  const loadConsumptionHistory = async () => {
    try {
      const deliveries = await fetchMaterialDeliveries();
      console.log('Deliveries data received:', deliveries);
      
      // Procesar consumos con la nueva estructura de datos optimizada
      const consumptions = deliveries
        .filter(delivery => delivery.quantity_consumed > 0)
        .map(delivery => {
          console.log('Processing delivery:', delivery);
          
          return {
            id: delivery.id,
            orderId: delivery.order_id,
            materialId: delivery.material_id,
            materialName: delivery.materials?.name || 'Material desconocido',
            workshopId: delivery.workshop_id,
            workshopName: delivery.workshops?.name || 'Taller desconocido',
            quantityConsumed: delivery.quantity_consumed,
            consumedDate: delivery.updated_at,
            orderNumber: delivery.orders?.order_number || 'Sin orden asignada'
          };
        });

      console.log('Processed consumptions:', consumptions);
      setConsumptionHistory(consumptions);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      setConsumptionHistory([]);
    }
  };

  const activeOrders = orders.filter(order => 
    ['pending', 'assigned', 'in_progress'].includes(order.status)
  );

  const filteredOrders = activeOrders.filter(order => {
    if (filters.status !== 'all' && order.status !== filters.status) return false;
    return true;
  });

  const filteredConsumptions = consumptionHistory.filter(consumption => {
    if (filters.workshop !== 'all' && consumption.workshopId !== filters.workshop) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
      assigned: { label: 'Asignada', color: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'En Proceso', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Completada', color: 'bg-green-100 text-green-700' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const handleRegisterConsumption = (order: any) => {
    setSelectedOrder(order);
    setShowConsumptionForm(true);
  };

  const handleConsumptionCompleted = () => {
    setShowConsumptionForm(false);
    setSelectedOrder(null);
    loadData();
  };

  const loading = ordersLoading || workshopsLoading || consumptionLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2 text-black">Cargando datos de consumo...</h3>
          <p className="text-gray-600">Obteniendo información de órdenes y materiales</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-5 h-5" />
              <span>Filtros de Consumo</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Taller</label>
                <Select value={filters.workshop} onValueChange={(value) => setFilters(prev => ({ ...prev, workshop: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los talleres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los talleres</SelectItem>
                    {workshops.map((workshop) => (
                      <SelectItem key={workshop.id} value={workshop.id}>
                        {workshop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Estado de Orden</label>
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="assigned">Asignada</SelectItem>
                    <SelectItem value="in_progress">En Proceso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Órdenes Activas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Órdenes de Producción Activas</span>
              </div>
              <Badge variant="outline">{filteredOrders.length} órdenes</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay órdenes activas</h3>
                <p className="text-gray-600">Las órdenes aparecerán aquí cuando tengan estado pendiente, asignada o en proceso</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-semibold">{order.order_number}</div>
                        <div className="text-sm text-gray-600">
                          Creada: {new Date(order.created_at).toLocaleDateString()}
                          {order.due_date && ` • Entrega: ${new Date(order.due_date).toLocaleDateString()}`}
                        </div>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>
                    <Button
                      onClick={() => handleRegisterConsumption(order)}
                      size="sm"
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Registrar Consumo
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial de Consumos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Historial de Consumos</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredConsumptions.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay consumos registrados</h3>
                <p className="text-gray-600">Los consumos de materiales aparecerán aquí cuando se registren</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orden</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Taller</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsumptions.map((consumption) => (
                    <TableRow key={consumption.id}>
                      <TableCell className="font-medium">{consumption.orderNumber}</TableCell>
                      <TableCell>{consumption.materialName}</TableCell>
                      <TableCell>{consumption.workshopName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-red-500 text-red-700">
                          -{consumption.quantityConsumed}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(consumption.consumedDate).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Registro de Consumo */}
      {showConsumptionForm && selectedOrder && (
        <MaterialConsumptionForm
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.order_number}
          onClose={() => {
            setShowConsumptionForm(false);
            setSelectedOrder(null);
          }}
          onConsumptionCompleted={handleConsumptionCompleted}
        />
      )}
    </>
  );
};

export default MaterialConsumptionManager;
