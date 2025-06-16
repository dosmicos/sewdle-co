
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Users, FileText, Calendar } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import WorkshopAssignmentForm from '@/components/WorkshopAssignmentForm';
import WorkshopAssignmentsList from '@/components/WorkshopAssignmentsList';
import WorkshopCapacityDashboard from '@/components/WorkshopCapacityDashboard';
import { useOrders } from '@/hooks/useOrders';
import { Badge } from '@/components/ui/badge';

const OrdersPage = () => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const { fetchOrders, loading } = useOrders();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const ordersData = await fetchOrders();
    setOrders(ordersData || []);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'assigned':
        return 'Asignada';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  return (
    <>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">Gestión de Órdenes</h1>
            <p className="text-gray-600">Gestiona órdenes de producción y asignaciones de trabajo</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowAssignmentForm(true)}
              variant="outline"
              className="border border-gray-300 bg-white hover:bg-gray-50 text-black font-medium rounded-xl px-6 py-3"
            >
              <Users className="w-4 h-4 mr-2" />
              Asignar a Taller
            </Button>
            <Button 
              onClick={() => setShowOrderForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Orden
            </Button>
          </div>
        </div>

        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders">Órdenes de Producción</TabsTrigger>
            <TabsTrigger value="assignments">Asignaciones de Trabajo</TabsTrigger>
            <TabsTrigger value="capacity">Capacidad de Talleres</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-6">
            <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder="Buscar órdenes..." 
                    className="w-full bg-white border border-gray-300 rounded-xl text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
                    style={{ paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
                </div>
                <Button
                  onClick={loadOrders}
                  variant="outline"
                  disabled={loading}
                  className="text-black border-gray-300"
                >
                  {loading ? 'Cargando...' : 'Actualizar'}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Cargando órdenes...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-black">No hay órdenes aún</h3>
                  <p className="text-gray-600 mb-4">Comienza creando tu primera orden de producción</p>
                  <Button 
                    onClick={() => setShowOrderForm(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Orden
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <Card key={order.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start space-x-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                              <FileText className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-black">{order.order_number}</h3>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {formatDate(order.created_at)}
                                </span>
                                {order.due_date && (
                                  <span className="flex items-center">
                                    Entrega: {formatDate(order.due_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(order.status)}>
                              {getStatusText(order.status)}
                            </Badge>
                            {order.total_amount && (
                              <p className="text-lg font-semibold text-black mt-2">
                                {formatCurrency(order.total_amount)}
                              </p>
                            )}
                          </div>
                        </div>

                        {order.notes && (
                          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">{order.notes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Productos: </span>
                            <span className="text-gray-600">
                              {order.order_items?.length || 0} items
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Insumos: </span>
                            <span className="text-gray-600">
                              {order.order_supplies?.length || 0} materiales
                            </span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Archivos: </span>
                            <span className="text-gray-600">
                              {order.order_files?.length || 0} adjuntos
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <WorkshopAssignmentsList />
          </TabsContent>

          <TabsContent value="capacity" className="space-y-6">
            <WorkshopCapacityDashboard />
          </TabsContent>
        </Tabs>
      </div>

      {showOrderForm && (
        <OrderForm onClose={() => {
          setShowOrderForm(false);
          loadOrders(); // Recargar órdenes después de crear una nueva
        }} />
      )}

      {showAssignmentForm && (
        <WorkshopAssignmentForm 
          open={showAssignmentForm} 
          onClose={() => setShowAssignmentForm(false)} 
        />
      )}
    </>
  );
};

export default OrdersPage;
