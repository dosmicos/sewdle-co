import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilteredOrders } from '@/hooks/useFilteredOrders';
import { useUserContext } from '@/hooks/useUserContext';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrderActions } from '@/hooks/useOrderActions';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TrendingUp } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import OrderEditModal from '@/components/OrderEditModal';
import OrderCard from '@/components/OrderCard';
import OrderFilters from '@/components/OrderFilters';
import OrdersEmptyState from '@/components/OrdersEmptyState';

const OrdersPage = () => {
  const navigate = useNavigate();
  const { orders, loading, refetch } = useFilteredOrders();
  const { isAdmin } = useUserContext();
  const { hasPermission } = usePermissions();
  const { workshops } = useWorkshops();
  const { deleteOrder } = useOrderActions();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Permission checks
  const canCreateOrders = hasPermission('orders', 'create');
  const canEditOrders = hasPermission('orders', 'edit');
  const canDeleteOrders = hasPermission('orders', 'delete');

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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

  const getWorkshopName = (order: any) => {
    return order.workshop_assignments?.[0]?.workshops?.name || 'Sin asignar';
  };

  const getWorkshopColor = (order: any) => {
    return order.workshop_assignments?.[0]?.workshops?.name ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  };

  // Event handlers
  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleViewDetails = (order: any) => {
    navigate(`/orders/${order.id}`);
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

  const handleDeleteOrder = (order: any) => {
    setOrderToDelete(order);
    setShowDeleteDialog(true);
  };

  const confirmDeleteOrder = async () => {
    if (orderToDelete) {
      const success = await deleteOrder(orderToDelete.id);
      if (success) {
        refetch();
      }
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedWorkshop('all');
    setSelectedStatus('all');
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedWorkshop !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    return count;
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '';
    const matchesWorkshop = selectedWorkshop === 'all' || 
                           (selectedWorkshop === 'unassigned' && !order.workshop_assignments?.length) ||
                           order.workshop_assignments?.some((assignment: any) => assignment.workshop_id === selectedWorkshop);
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesWorkshop && matchesStatus;
  });

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
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header con título y breadcrumbs */}
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-500">
          <span>Producción</span>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Órdenes</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Órdenes de Producción</h1>
            <p className="text-gray-600 text-sm md:text-base">Administra y monitorea todas las órdenes de producción</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>{filteredOrders.length} órdenes</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <OrderFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedWorkshop={selectedWorkshop}
        setSelectedWorkshop={setSelectedWorkshop}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        workshops={workshops}
        showFiltersSheet={showFiltersSheet}
        setShowFiltersSheet={setShowFiltersSheet}
        onRefetch={refetch}
        onClearFilters={clearFilters}
        getActiveFiltersCount={getActiveFiltersCount}
        canCreateOrders={canCreateOrders}
        onCreateOrder={() => setShowCreateForm(true)}
      />

      {showCreateForm && canCreateOrders && (
        <OrderForm onClose={handleFormClose} />
      )}

      {/* Lista de órdenes */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <OrdersEmptyState
            searchTerm={searchTerm}
            selectedWorkshop={selectedWorkshop}
            selectedStatus={selectedStatus}
            isAdmin={isAdmin}
          />
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onView={handleViewDetails}
              onEdit={handleEditOrder}
              onDelete={handleDeleteOrder}
              getStatusColor={getStatusColor}
              getStatusText={getStatusText}
              getWorkshopName={getWorkshopName}
              getWorkshopColor={getWorkshopColor}
              canEdit={canEditOrders}
              canDelete={canDeleteOrders}
            />
          ))
        )}
      </div>

      {/* Modales */}
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


      {/* AlertDialog para confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la orden "{orderToDelete?.order_number}"? 
              Esta acción no se puede deshacer y eliminará todos los datos asociados incluyendo entregas, items y asignaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOrder} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;
