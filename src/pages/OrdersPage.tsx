
import React from 'react';
import { useFilteredOrders } from '@/hooks/useFilteredOrders';
import { useUserContext } from '@/hooks/useUserContext';
import OrderForm from '@/components/OrderForm';
import OrderEditModal from '@/components/OrderEditModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Calendar, User, Eye, Edit, Search, RefreshCw, FileText, Building } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

const OrdersPage = () => {
  const { orders, loading, refetch } = useFilteredOrders();
  const { isAdmin } = useUserContext();
  const { deleteOrder } = useOrderActions();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'assigned': return 'Asignada';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedOrder(null);
    refetch();
  };

  const handleDeleteOrder = async (orderId: string) => {
    const success = await deleteOrder(orderId);
    if (success) {
      setShowDetailsModal(false);
      setSelectedOrder(null);
      refetch();
    }
  };

  const filteredOrders = orders.filter(order =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-6 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-2xl"
          >
            <RefreshCw className="w-4 h-4" />
            Actualizar
          </Button>
          
          {isAdmin && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Nueva Orden
            </Button>
          )}
        </div>
      </div>

      {showCreateForm && isAdmin && (
        <OrderForm onClose={handleFormClose} />
      )}

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                {searchTerm ? 'No se encontraron órdenes' : (isAdmin ? 'No hay órdenes' : 'No tienes órdenes asignadas')}
              </h3>
              <p className="text-gray-500">
                {searchTerm 
                  ? 'Intenta con otros términos de búsqueda'
                  : (isAdmin 
                    ? 'Cuando se creen órdenes, aparecerán aquí.'
                    : 'Cuando se te asignen órdenes, aparecerán aquí.'
                  )
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="bg-white border-0 shadow-sm rounded-2xl hover:shadow-md transition-all duration-200">
              <CardContent className="p-6">
                {/* Header Section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{order.order_number}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(order.created_at), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <span>
                          Entrega: {order.due_date ? format(new Date(order.due_date), 'dd MMM yyyy', { locale: es }) : 'Sin fecha'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge className={`${getStatusColor(order.status)} border rounded-full px-3 py-1`}>
                      {getStatusText(order.status)}
                    </Badge>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0} unidades
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workshop Info */}
                {order.workshop_assignments?.[0]?.workshops?.name && (
                  <div className="flex items-center gap-2 mb-4">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Taller: {order.workshop_assignments[0].workshops.name}
                    </span>
                  </div>
                )}

                {/* Stats Section */}
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-2xl">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">Productos:</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {order.order_items?.length || 0} items
                    </div>
                  </div>
                  <div className="text-center border-l border-r border-gray-200">
                    <div className="text-sm text-gray-500 mb-1">Insumos:</div>
                    <div className="text-lg font-semibold text-gray-900">0 materiales</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-1">Archivos:</div>
                    <div className="text-lg font-semibold text-gray-900">0 adjuntos</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleViewDetails(order)}
                    className="flex items-center gap-2 px-4 py-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditOrder(order)}
                      className="flex items-center gap-2 px-4 py-2 border-green-200 text-green-600 hover:bg-green-50 rounded-xl"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2 px-4 py-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                  >
                    <Package className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modals */}
      {selectedOrder && showEditModal && (
        <OrderEditModal
          order={selectedOrder}
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {selectedOrder && showDetailsModal && (
        <OrderDetailsModal
          order={selectedOrder}
          open={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOrder(null);
          }}
          onEdit={handleEditOrder}
          onDelete={handleDeleteOrder}
        />
      )}
    </div>
  );
};

export default OrdersPage;
