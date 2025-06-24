import React, { useState, useMemo } from 'react';
import { useFilteredDeliveries } from '@/hooks/useFilteredDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useAuth } from '@/contexts/AuthContext';
import DeliveryForm from '@/components/DeliveryForm';
import DeliveryDetails from '@/components/DeliveryDetails';
import InventorySyncManager from '@/components/supplies/InventorySyncManager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Truck, Calendar, MapPin, Eye, Search, Filter, Package, CheckCircle, AlertTriangle, Clock, XCircle, Zap, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const DeliveriesPage = () => {
  const { deliveries, loading, refetch } = useFilteredDeliveries();
  const { deleteDelivery } = useDeliveries();
  const { isAdmin } = useUserContext();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Permission checks
  const canCreateDeliveries = hasPermission('entregas', 'create');
  const canEditDeliveries = hasPermission('entregas', 'edit');
  const canDeleteDeliveries = hasPermission('entregas', 'delete');

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

  // Filter deliveries based on search term and active tab
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

    // Apply tab filter
    if (activeTab !== 'all') {
      filtered = filtered.filter(delivery => {
        switch (activeTab) {
          case 'in_quality':
            return delivery.status === 'in_quality';
          case 'approved':
            return delivery.status === 'approved' || delivery.status === 'partial_approved';
          case 'rejected':
            return delivery.status === 'rejected';
          case 'sync':
            return true; // Sync tab shows all deliveries for sync management
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [deliveries, searchTerm, activeTab]);

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

  const handleDeleteDelivery = async (deliveryId: string, trackingNumber: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la entrega ${trackingNumber}?`)) {
      const success = await deleteDelivery(deliveryId);
      if (success) {
        refetch();
      }
    }
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? 'Gestión de Entregas' : 'Mis Entregas'}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Administra todas las entregas del sistema' : 'Entregas de tu taller'}
          </p>
        </div>
        {canCreateDeliveries && (
          <Button onClick={() => setShowCreateForm(true)}>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por número de seguimiento, orden o taller..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
          <TabsTrigger value="in_quality">En Calidad ({stats.in_quality})</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas ({stats.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas ({stats.rejected})</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="sync">
              <Zap className="w-4 h-4 mr-2" />
              Sincronización Shopify
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <DeliveryTable 
            deliveries={filteredDeliveries} 
            onViewDetails={setSelectedDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            canDeleteDeliveries={canDeleteDeliveries}
          />
        </TabsContent>

        <TabsContent value="in_quality" className="space-y-4">
          <DeliveryTable 
            deliveries={filteredDeliveries} 
            onViewDetails={setSelectedDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            canDeleteDeliveries={canDeleteDeliveries}
          />
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <DeliveryTable 
            deliveries={filteredDeliveries} 
            onViewDetails={setSelectedDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            canDeleteDeliveries={canDeleteDeliveries}
          />
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <DeliveryTable 
            deliveries={filteredDeliveries} 
            onViewDetails={setSelectedDelivery}
            onDeleteDelivery={handleDeleteDelivery}
            canDeleteDeliveries={canDeleteDeliveries}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="sync" className="space-y-4">
            <InventorySyncManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

// Separate component for the delivery table
const DeliveryTable = ({ 
  deliveries, 
  onViewDetails, 
  onDeleteDelivery, 
  canDeleteDeliveries 
}: { 
  deliveries: any[], 
  onViewDetails: (delivery: any) => void,
  onDeleteDelivery: (deliveryId: string, trackingNumber: string) => void,
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

  // Use pre-calculated quantities from database function
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
                  <TableCell>{quantities.total}</TableCell>
                  <TableCell>{quantities.approved}</TableCell>
                  <TableCell>{quantities.defective}</TableCell>
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
                          onClick={() => onDeleteDelivery(delivery.id, delivery.tracking_number)}
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
