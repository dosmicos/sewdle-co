
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Users, FileText, Calendar, Eye, Edit, Trash2, Package, Factory } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import WorkshopAssignmentForm from '@/components/WorkshopAssignmentForm';
import WorkshopAssignmentsList from '@/components/WorkshopAssignmentsList';
import WorkshopCapacityDashboard from '@/components/WorkshopCapacityDashboard';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import OrderEditModal from '@/components/OrderEditModal';
import { useOrders } from '@/hooks/useOrders';
import { useOrderActions } from '@/hooks/useOrderActions';
import { Badge } from '@/components/ui/badge';

const OrdersPage = () => {
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const { fetchOrders, loading } = useOrders();
  const { deleteOrder } = useOrderActions();

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    const ordersData = await fetchOrders();
    setOrders(ordersData || []);
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleEdit = (order: any) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleDelete = async (orderId: string) => {
    const success = await deleteOrder(orderId);
    if (success) {
      loadOrders(); // Recargar la lista
      setShowDetailsModal(false); // Cerrar modal si está abierto
    }
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

  const getTotalQuantity = (order: any) => {
    if (!order.order_items) return 0;
    return order.order_items.reduce((total: number, item: any) => total + item.quantity, 0);
  };

  const getAssignedWorkshop = (order: any) => {
    if (order.workshop_assignments && order.workshop_assignments.length > 0) {
      return order.workshop_assignments[0].workshops?.name;
    }
    return null;
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
                  {orders.map((order) => {
                    const totalQuantity = getTotalQuantity(order);
                    const assignedWorkshop = getAssignedWorkshop(order);
                    
                    return (
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
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(order.status)}>
                                {getStatusText(order.status)}
                              </Badge>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-blue-600">
                                  {totalQuantity} unidades
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Mostrar taller asignado */}
                          {assignedWorkshop && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center space-x-2">
                                <Factory className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-600">Taller:</span>
                                <span className="text-sm text-blue-800">{assignedWorkshop}</span>
                              </div>
                            </div>
                          )}

                          {order.notes && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-700">{order.notes}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm flex-1">
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
                            
                            <div className="flex items-center space-x-2 ml-4">
                              <Button
                                onClick={() => handleViewDetails(order)}
                                variant="outline"
                                size="sm"
                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleEdit(order)}
                                variant="outline"
                                size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => handleDelete(order.id)}
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
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

      {showDetailsModal && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          open={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {showEditModal && selectedOrder && (
        <OrderEditModal
          order={selectedOrder}
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={loadOrders}
        />
      )}
    </>
  );
};

export default OrdersPage;
