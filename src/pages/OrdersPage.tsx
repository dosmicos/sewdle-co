import React from 'react';
import { useFilteredOrders } from '@/hooks/useFilteredOrders';
import { useUserContext } from '@/hooks/useUserContext';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrderStats } from '@/hooks/useOrderStats';
import OrderForm from '@/components/OrderForm';
import OrderEditModal from '@/components/OrderEditModal';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Package, Calendar, User, Eye, Edit, Search, RefreshCw, FileText, Building, Trash2, Filter, TrendingUp, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
const OrdersPage = () => {
  const {
    orders,
    loading,
    refetch
  } = useFilteredOrders();
  const {
    isAdmin
  } = useUserContext();
  const {
    hasPermission
  } = useAuth();
  const {
    workshops
  } = useWorkshops();
  const {
    deleteOrder
  } = useOrderActions();
  const isMobile = useIsMobile();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);

  // Verificar si el usuario puede crear órdenes
  const canCreateOrders = hasPermission('orders', 'create');
  // Verificar si el usuario puede editar órdenes
  const canEditOrders = hasPermission('orders', 'edit');
  // Verificar si el usuario puede eliminar órdenes
  const canDeleteOrders = hasPermission('orders', 'delete');
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
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) || order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '';
    const matchesWorkshop = selectedWorkshop === 'all' || selectedWorkshop === 'unassigned' && !order.workshop_assignments?.length || order.workshop_assignments?.some((assignment: any) => assignment.workshop_id === selectedWorkshop);
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesWorkshop && matchesStatus;
  });

  // Componente para el contenido de filtros
  const FiltersContent = () => <div className="space-y-4">
      {/* Filtro por taller */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Taller</label>
        <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los talleres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los talleres</SelectItem>
            {workshops.map(workshop => <SelectItem key={workshop.id} value={workshop.id}>
                {workshop.name}
              </SelectItem>)}
            <SelectItem value="unassigned">Sin asignar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filtro por estado */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="assigned">Asignada</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Botón limpiar filtros */}
      <div className="pt-4 border-t">
        <Button variant="outline" onClick={() => {
        clearFilters();
        setShowFiltersSheet(false);
      }} className="w-full flex items-center gap-2">
          <X className="w-4 h-4" />
          Limpiar filtros
        </Button>
      </div>
    </div>;
  if (loading) {
    return <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>;
  }
  return <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
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

      {/* Filtros mejorados - Responsive */}
      <Card className="bg-white border-0 shadow-sm rounded-2xl">
        <CardContent className="p-4 md:p-6">
          {isMobile ?
        // Vista móvil con drawer
        <div className="space-y-4">
              {/* Búsqueda principal siempre visible */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type="text" placeholder="Buscar órdenes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>

              {/* Botones de acción móvil */}
              <div className="flex gap-3 justify-between">
                <div className="flex gap-2">
                  {/* Botón de filtros con Sheet */}
                  <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="flex items-center gap-2 px-4 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl relative">
                        <Filter className="w-4 h-4" />
                        Filtros
                        {getActiveFiltersCount() > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-blue-600 text-white text-xs p-0 flex items-center justify-center">
                            {getActiveFiltersCount()}
                          </Badge>}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-auto max-h-[80vh]">
                      <SheetHeader className="text-left pb-6">
                        <SheetTitle>Filtros de búsqueda</SheetTitle>
                        <SheetDescription>
                          Ajusta los filtros para encontrar las órdenes que necesitas
                        </SheetDescription>
                      </SheetHeader>
                      <FiltersContent />
                    </SheetContent>
                  </Sheet>

                  <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2 px-4 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                
                {canCreateOrders && <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg">
                    <Plus className="w-4 h-4" />
                    Nueva
                  </Button>}
              </div>
            </div> :
        // Vista desktop original
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input type="text" placeholder="Buscar órdenes..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                {/* Filtro por taller */}
                <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-200">
                    <SelectValue placeholder="Todos los talleres" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los talleres</SelectItem>
                    {workshops.map(workshop => <SelectItem key={workshop.id} value={workshop.id}>
                        {workshop.name}
                      </SelectItem>)}
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro por estado */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-12 rounded-xl border-gray-200">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="assigned">Asignada</SelectItem>
                    <SelectItem value="in_progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>

                {/* Limpiar filtros */}
                <Button variant="outline" onClick={clearFilters} className="h-12 px-4 border-gray-200 hover:bg-gray-50 rounded-xl">
                  <Filter className="w-4 h-4" />
                  Limpiar
                </Button>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2 px-6 py-3 bg-white border-gray-200 hover:bg-gray-50 rounded-xl">
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </Button>
                
                {canCreateOrders && <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg bg-[#ff5c02]">
                    <Plus className="w-4 h-4" />
                    Nueva Orden
                  </Button>}
              </div>
            </div>}
        </CardContent>
      </Card>

      {showCreateForm && canCreateOrders && <OrderForm onClose={handleFormClose} />}

      {/* Lista de órdenes mejorada */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                {searchTerm || selectedWorkshop !== 'all' || selectedStatus !== 'all' ? 'No se encontraron órdenes' : isAdmin ? 'No hay órdenes' : 'No tienes órdenes asignadas'}
              </h3>
              <p className="text-gray-500">
                {searchTerm || selectedWorkshop !== 'all' || selectedStatus !== 'all' ? 'Intenta ajustar los filtros de búsqueda' : isAdmin ? 'Cuando se creen órdenes, aparecerán aquí.' : 'Cuando se te asignen órdenes, aparecerán aquí.'}
              </p>
            </CardContent>
          </Card> : filteredOrders.map(order => <OrderCard key={order.id} order={order} onView={handleViewDetails} onEdit={handleEditOrder} onDelete={handleDeleteOrder} getStatusColor={getStatusColor} getStatusText={getStatusText} getWorkshopName={getWorkshopName} getWorkshopColor={getWorkshopColor} canEdit={canEditOrders} canDelete={canDeleteOrders} />)}
      </div>

      {/* Modales */}
      {selectedOrder && showEditModal && <OrderEditModal order={selectedOrder} open={showEditModal} onClose={() => {
      setShowEditModal(false);
      setSelectedOrder(null);
    }} onSuccess={handleEditSuccess} />}

      {selectedOrder && showDetailsModal && <OrderDetailsModal order={selectedOrder} open={showDetailsModal} onClose={() => {
      setShowDetailsModal(false);
      setSelectedOrder(null);
    }} onEdit={handleEditOrder} onDelete={handleDeleteOrder} />}

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
    </div>;
};

// Componente separado para las tarjetas de órdenes
const OrderCard = ({
  order,
  onView,
  onEdit,
  onDelete,
  getStatusColor,
  getStatusText,
  getWorkshopName,
  getWorkshopColor,
  canEdit,
  canDelete
}: any) => {
  const {
    stats,
    loading: statsLoading,
    error: statsError
  } = useOrderStats(order.id);
  const isMobile = useIsMobile();
  return <Card className="bg-white border-0 shadow-sm rounded-2xl hover:shadow-md transition-all duration-200">
      <CardContent className="p-4 md:p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-gray-900">{order.order_number}</h3>
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs md:text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  {format(new Date(order.created_at), 'dd MMM yyyy', {
                  locale: es
                })}
                </span>
                <span>
                  Entrega: {order.due_date ? format(new Date(order.due_date), 'dd MMM yyyy', {
                  locale: es
                }) : 'Sin fecha'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(order.status)} border rounded-full px-2 md:px-3 py-1 text-xs`}>
              {getStatusText(order.status)}
            </Badge>
          </div>
        </div>

        {/* Información del taller - Más prominente */}
        <div className="mb-4">
          <Badge className={`${getWorkshopColor(order)} border rounded-full px-2 md:px-3 py-1 text-xs md:text-sm`}>
            <Building className="w-3 h-3 md:w-4 md:h-4 mr-1" />
            {getWorkshopName(order)}
          </Badge>
        </div>

        {/* Estadísticas de progreso */}
        <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-2xl">
          {statsError ? <div className="text-center py-4">
              <div className="text-sm text-red-600 mb-2">
                Error al cargar estadísticas
              </div>
              <div className="text-xs text-gray-500">
                Los datos se mostrarán cuando estén disponibles
              </div>
            </div> : <>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-blue-600">
                    {statsLoading ? <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div> : stats.totalOrdered}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Ordenado</div>
                </div>
                <div className="text-center border-l border-r border-gray-200">
                  <div className="text-lg md:text-2xl font-bold text-green-600">
                    {statsLoading ? <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div> : stats.totalApproved}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Aprobado</div>
                </div>
                <div className="text-center">
                  <div className="text-lg md:text-2xl font-bold text-orange-600">
                    {statsLoading ? <div className="w-6 md:w-8 h-4 md:h-6 bg-gray-200 rounded animate-pulse mx-auto"></div> : stats.totalPending}
                  </div>
                  <div className="text-xs md:text-sm text-gray-500">Pendiente</div>
                </div>
              </div>
              
              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-gray-600">Progreso de producción</span>
                  <span className="font-medium text-gray-900">
                    {statsLoading ? <div className="w-8 md:w-12 h-3 md:h-4 bg-gray-200 rounded animate-pulse"></div> : `${stats.completionPercentage}%`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ${statsLoading ? 'bg-gray-300 animate-pulse' : 'bg-blue-500'}`} style={{
                width: `${statsLoading ? 30 : stats.completionPercentage}%`
              }}></div>
                </div>
              </div>
            </>}
        </div>

        {/* Action Buttons */}
        <div className={`flex gap-2 md:gap-3 ${isMobile ? 'justify-center' : 'justify-end'}`}>
          <Button variant="outline" size="sm" onClick={() => onView(order)} className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl text-xs md:text-sm">
            <Eye className="w-3 h-3 md:w-4 md:h-4" />
            {isMobile ? '' : 'Ver'}
          </Button>
          {canEdit && <Button variant="outline" size="sm" onClick={() => onEdit(order)} className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-green-200 text-green-600 hover:bg-green-50 rounded-xl text-xs md:text-sm">
              <Edit className="w-3 h-3 md:w-4 md:h-4" />
              {isMobile ? '' : 'Editar'}
            </Button>}
          {canDelete && <Button variant="outline" size="sm" onClick={() => onDelete(order)} className="flex items-center gap-1 md:gap-2 px-3 md:px-4 py-2 border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs md:text-sm">
              <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
              {isMobile ? '' : 'Eliminar'}
            </Button>}
        </div>
      </CardContent>
    </Card>;
};
export default OrdersPage;