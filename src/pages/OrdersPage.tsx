
import React from 'react';
import { useFilteredOrders } from '@/hooks/useFilteredOrders';
import { useUserContext } from '@/hooks/useUserContext';
import OrderForm from '@/components/OrderForm';
import OrderEditModal from '@/components/OrderEditModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Calendar, User, Eye, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';

const OrdersPage = () => {
  const { orders, loading, refetch } = useFilteredOrders();
  const { isAdmin } = useUserContext();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    refetch();
  };

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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Gestión de Órdenes' : 'Mis Órdenes'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Administra todas las órdenes del sistema' : 'Órdenes asignadas a tu taller'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        )}
      </div>

      {showCreateForm && isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Orden</CardTitle>
            <CardDescription>Completa los detalles para crear una nueva orden</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderForm onFormSubmit={handleFormSuccess} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isAdmin ? 'No hay órdenes' : 'No tienes órdenes asignadas'}
              </h3>
              <p className="text-muted-foreground">
                {isAdmin 
                  ? 'Cuando se creen órdenes, aparecerán aquí.'
                  : 'Cuando se te asignen órdenes, aparecerán aquí.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{order.order_number}</h3>
                    <p className="text-muted-foreground">{order.client_name}</p>
                  </div>
                  <Badge className={getStatusColor(order.status)}>
                    {getStatusText(order.status)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    {order.due_date ? format(new Date(order.due_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Package className="w-4 h-4 mr-2" />
                    {order.order_items?.length || 0} items
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total: ${order.total_amount?.toFixed(2) || '0.00'}
                  </div>
                  {order.workshop_assignments?.[0]?.workshops?.name && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <User className="w-4 h-4 mr-2" />
                      {order.workshop_assignments[0].workshops.name}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDetails(order)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalles
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" size="sm" onClick={() => handleEditOrder(order)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedOrder && showEditModal && (
        <OrderEditModal
          order={selectedOrder}
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
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
        />
      )}
    </div>
  );
};

export default OrdersPage;
