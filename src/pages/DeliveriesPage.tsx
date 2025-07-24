import React, { useState, useMemo } from 'react';
import { useFilteredDeliveries } from '@/hooks/useFilteredDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/contexts/AuthContext';
import DeliveryForm from '@/components/DeliveryForm';
import DeliveryDetails from '@/components/DeliveryDetails';
import InventorySyncManager from '@/components/supplies/InventorySyncManager';
import { ShopifySyncDiagnostics } from '@/components/supplies/ShopifySyncDiagnostics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Truck, Calendar, MapPin, Eye, Search, Filter, Package, CheckCircle, AlertTriangle, Clock, XCircle, Zap, Trash2, X, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const DeliveriesPage = () => {
  const { deliveries, loading, refetch } = useFilteredDeliveries();
  const { deleteDelivery } = useDeliveries();
  const { isAdmin } = useUserContext();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deliveryToDelete, setDeliveryToDelete] = useState<any>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [workshopFilter, setWorkshopFilter] = useState('all');

  // Permission checks - using correct English module names
  const canCreateDeliveries = hasPermission('deliveries', 'create');
  const canEditDeliveries = hasPermission('deliveries', 'edit');
  const canDeleteDeliveries = hasPermission('deliveries', 'delete');

  // Get unique workshops for filter
  const workshopOptions = [...new Set(deliveries.map(d => d.workshop_name).filter(Boolean))];

  // Count active filters
  const activeFiltersCount = [statusFilter, workshopFilter].filter(f => f !== 'all').length;

  const clearFilters = () => {
    setStatusFilter('all');
    setWorkshopFilter('all');
    setSearchTerm('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_quality': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'partial_approved': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_quality': return 'En Revisión';
      case 'approved': return 'Aprobada';
      case 'partial_approved': return 'Parcial';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'in_quality': return <AlertTriangle className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'partial_approved': return <AlertTriangle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  // Filter deliveries based on search term and active filters
  const filteredDeliveries = useMemo(() => {
    let filtered = deliveries;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(delivery => 
        delivery.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.workshop_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(delivery => delivery.status === statusFilter);
    }

    // Apply workshop filter
    if (workshopFilter !== 'all') {
      filtered = filtered.filter(delivery => delivery.workshop_name === workshopFilter);
    }

    // Apply tab filter
    if (activeTab !== 'all' && activeTab !== 'sync') {
      filtered = filtered.filter(delivery => {
        switch (activeTab) {
          case 'in_quality':
            return delivery.status === 'in_quality';
          case 'approved':
            return delivery.status === 'approved' || delivery.status === 'partial_approved';
          case 'rejected':
            return delivery.status === 'rejected';
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [deliveries, searchTerm, statusFilter, workshopFilter, activeTab]);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === 'pending').length,
      in_quality: deliveries.filter(d => d.status === 'in_quality').length,
      approved: deliveries.filter(d => d.status === 'approved' || d.status === 'partial_approved').length,
      rejected: deliveries.filter(d => d.status === 'rejected').length,
    };
  }, [deliveries]);

  const handleFormClose = () => {
    setShowCreateForm(false);
    refetch();
  };

  const handleDeliveryDetailsBack = (shouldRefresh?: boolean) => {
    setSelectedDelivery(null);
    if (shouldRefresh) {
      refetch();
    }
  };

  const handleDeleteDelivery = (delivery: any) => {
    setDeliveryToDelete(delivery);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDelivery = async () => {
    if (deliveryToDelete) {
      const success = await deleteDelivery(deliveryToDelete.id);
      if (success) {
        refetch();
      }
      setShowDeleteDialog(false);
      setDeliveryToDelete(null);
    }
  };

  // Componente para el contenido de filtros
  const FiltersContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Estado</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_quality">En Revisión</SelectItem>
            <SelectItem value="approved">Aprobada</SelectItem>
            <SelectItem value="partial_approved">Parcial</SelectItem>
            <SelectItem value="rejected">Rechazada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Taller</label>
        <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos los talleres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los talleres</SelectItem>
            {workshopOptions.map((workshop) => (
              <SelectItem key={workshop} value={workshop}>
                {workshop}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={() => {
            clearFilters();
            setShowFiltersSheet(false);
          }}
          className="w-full flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Limpiar filtros
        </Button>
      </div>
    </div>
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

  // Show delivery details if a delivery is selected
  if (selectedDelivery) {
    return (
      <DeliveryDetails
        delivery={selectedDelivery}
        onBack={handleDeliveryDetailsBack}
      />
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-3 md:flex-row md:justify-between md:items-center md:space-y-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">
            {isAdmin ? 'Gestión de Entregas' : 'Mis Entregas'}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {isAdmin ? 'Administra todas las entregas del sistema' : 'Entregas de tu taller'}
          </p>
        </div>
        {canCreateDeliveries && (
          <Button 
            onClick={() => setShowCreateForm(true)}
            className="w-full md:w-auto bg-[#FF6B35] hover:bg-[#E5562B] text-white border-none"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Entrega
          </Button>
        )}
      </div>

      {showCreateForm && canCreateDeliveries && (
        <DeliveryForm
          onClose={handleFormClose}
          onDeliveryCreated={handleFormClose}
        />
      )}

      {/* Statistics Cards - Mobile First Design */}
      <div className={`${isMobile ? 'space-y-2' : 'grid grid-cols-5 gap-4'}`}>
        {isMobile ? (
          <>
            {/* Primera fila: Total */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Package className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Total</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Segunda fila: Pendientes y En Calidad */}
            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-xs font-medium">Pendientes</p>
                      <p className="text-xl font-bold">{stats.pending}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-xs font-medium">En Calidad</p>
                      <p className="text-xl font-bold">{stats.in_quality}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Tercera fila: Aprobadas y Rechazadas */}
            <div className="grid grid-cols-2 gap-2">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-xs font-medium">Aprobadas</p>
                      <p className="text-xl font-bold">{stats.approved}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-xs font-medium">Rechazadas</p>
                      <p className="text-xl font-bold">{stats.rejected}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Package className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Total</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">Pendientes</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">En Calidad</p>
                    <p className="text-2xl font-bold">{stats.in_quality}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Aprobadas</p>
                    <p className="text-2xl font-bold">{stats.approved}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Rechazadas</p>
                    <p className="text-2xl font-bold">{stats.rejected}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por número de seguimiento, orden o taller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {isMobile ? (
              <Sheet open={showFiltersSheet} onOpenChange={setShowFiltersSheet}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="relative shrink-0">
                    <Filter className="w-4 h-4 mr-1" />
                    Filtros
                    {activeFiltersCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">
                        {activeFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle>Filtros</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FiltersContent />
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <div className="flex items-center space-x-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in_quality">En Revisión</SelectItem>
                    <SelectItem value="approved">Aprobada</SelectItem>
                    <SelectItem value="partial_approved">Parcial</SelectItem>
                    <SelectItem value="rejected">Rechazada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Taller" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los talleres</SelectItem>
                    {workshopOptions.map((workshop) => (
                      <SelectItem key={workshop} value={workshop}>
                        {workshop}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeFiltersCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-2" />
                    Limpiar
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs - Optimized for mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className={`${isMobile ? 'grid grid-cols-5 w-max min-w-full' : 'grid grid-cols-6 w-full'} gap-1`}>
            <TabsTrigger value="all" className="whitespace-nowrap text-xs px-2">
              {isMobile ? `Todas (${stats.total})` : `Todas (${stats.total})`}
            </TabsTrigger>
            <TabsTrigger value="in_quality" className="whitespace-nowrap text-xs px-2">
              {isMobile ? `Calidad (${stats.in_quality})` : `En Calidad (${stats.in_quality})`}
            </TabsTrigger>
            <TabsTrigger value="approved" className="whitespace-nowrap text-xs px-2">
              {isMobile ? `Aprob. (${stats.approved})` : `Aprobadas (${stats.approved})`}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="whitespace-nowrap text-xs px-2">
              {isMobile ? `Rech. (${stats.rejected})` : `Rechazadas (${stats.rejected})`}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="sync" className="whitespace-nowrap text-xs px-2">
                {isMobile ? (
                  <Zap className="w-4 h-4" />
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Sync Shopify
                  </>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-4 mt-3">
          {isMobile ? (
            <DeliveryCards 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          ) : (
            <DeliveryTable 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          )}
        </TabsContent>

        <TabsContent value="in_quality" className="space-y-4 mt-3">
          {isMobile ? (
            <DeliveryCards 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          ) : (
            <DeliveryTable 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-3">
          {isMobile ? (
            <DeliveryCards 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          ) : (
            <DeliveryTable 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4 mt-3">
          {isMobile ? (
            <DeliveryCards 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          ) : (
            <DeliveryTable 
              deliveries={filteredDeliveries} 
              onViewDetails={setSelectedDelivery}
              onDeleteDelivery={handleDeleteDelivery}
              canDeleteDeliveries={canDeleteDeliveries}
            />
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="sync" className="space-y-4 mt-3">
            <InventorySyncManager />
          </TabsContent>
        )}
      </Tabs>

      {/* AlertDialog for delivery deletion confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la entrega "{deliveryToDelete?.tracking_number}"? 
              Esta acción no se puede deshacer y eliminará todos los datos asociados incluyendo los items de entrega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDelivery}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Componente para las tarjetas de entregas (vista móvil)
const DeliveryCards = ({ 
  deliveries, 
  onViewDetails, 
  onDeleteDelivery, 
  canDeleteDeliveries 
}: { 
  deliveries: any[], 
  onViewDetails: (delivery: any) => void,
  onDeleteDelivery: (delivery: any) => void,
  canDeleteDeliveries: boolean
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_quality': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'partial_approved': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_quality': return 'En Revisión';
      case 'approved': return 'Aprobada';
      case 'partial_approved': return 'Parcial';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  const getQuantities = (delivery: any) => {
    return {
      total: delivery.total_quantity || 0,
      approved: delivery.total_approved || 0,
      defective: delivery.total_defective || 0
    };
  };

  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay entregas</h3>
          <p className="text-muted-foreground">
            No se encontraron entregas que coincidan con los filtros seleccionados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {deliveries.map((delivery) => {
        const quantities = getQuantities(delivery);
        return (
          <Card key={delivery.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{delivery.tracking_number}</div>
                  <div className="text-xs text-muted-foreground">
                    Orden: {delivery.order_number}
                  </div>
                </div>
                <Badge className={`text-xs ${getStatusColor(delivery.status)}`}>
                  {getStatusText(delivery.status)}
                </Badge>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taller:</span>
                  <span className="font-medium">{delivery.workshop_name || 'Sin asignar'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fecha:</span>
                  <span>{delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="font-semibold text-blue-600">{quantities.total}</div>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <div className="text-xs text-muted-foreground">Aprobadas</div>
                  <div className="font-semibold text-green-600">{quantities.approved}</div>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <div className="text-xs text-muted-foreground">Defectuosas</div>
                  <div className="font-semibold text-red-600">{quantities.defective}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onViewDetails(delivery)}
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalles
                </Button>
                {canDeleteDeliveries && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onDeleteDelivery(delivery)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Componente para la tabla de entregas (vista desktop)
const DeliveryTable = ({ 
  deliveries, 
  onViewDetails, 
  onDeleteDelivery, 
  canDeleteDeliveries 
}: { 
  deliveries: any[], 
  onViewDetails: (delivery: any) => void,
  onDeleteDelivery: (delivery: any) => void,
  canDeleteDeliveries: boolean
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_quality': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'partial_approved': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_quality': return 'En Revisión';
      case 'approved': return 'Aprobada';
      case 'partial_approved': return 'Parcial';
      case 'rejected': return 'Rechazada';
      default: return status;
    }
  };

  const getQuantities = (delivery: any) => {
    return {
      total: delivery.total_quantity || 0,
      approved: delivery.total_approved || 0,
      defective: delivery.total_defective || 0
    };
  };

  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay entregas</h3>
          <p className="text-muted-foreground">
            No se encontraron entregas que coincidan con los filtros seleccionados.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Seguimiento</TableHead>
              <TableHead>Orden</TableHead>
              <TableHead>Taller</TableHead>
              <TableHead>Cantidad Total</TableHead>
              <TableHead>Aprobadas</TableHead>
              <TableHead>Defectuosas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((delivery) => {
              const quantities = getQuantities(delivery);
              return (
                <TableRow key={delivery.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{delivery.tracking_number}</TableCell>
                  <TableCell>{delivery.order_number}</TableCell>
                  <TableCell>{delivery.workshop_name || 'Sin asignar'}</TableCell>
                  <TableCell>
                    <span className="font-medium text-blue-600">{quantities.total}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-green-600">{quantities.approved}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-red-600">{quantities.defective}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(delivery.status)}>
                      {getStatusText(delivery.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {delivery.delivery_date ? format(new Date(delivery.delivery_date), 'dd/MM/yyyy', { locale: es }) : 'Sin fecha'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onViewDetails(delivery)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                      {canDeleteDeliveries && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => onDeleteDelivery(delivery)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default DeliveriesPage;
