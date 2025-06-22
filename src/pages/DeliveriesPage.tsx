
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import DeliveryForm from '@/components/DeliveryForm';
import DeliveryDetails from '@/components/DeliveryDetails';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeliveries } from '@/hooks/useDeliveries';

const DeliveriesPage = () => {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedWorkshop, setSelectedWorkshop] = useState('all');
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({
    total_deliveries: 0,
    pending_deliveries: 0,
    in_quality_deliveries: 0,
    approved_deliveries: 0,
    rejected_deliveries: 0
  });

  const { fetchDeliveries, getDeliveryStats, deleteDelivery, loading } = useDeliveries();

  useEffect(() => {
    loadDeliveries();
    loadStats();
  }, []);

  const loadDeliveries = async () => {
    const data = await fetchDeliveries();
    setDeliveries(data || []);
  };

  const loadStats = async () => {
    const statsData = await getDeliveryStats();
    setStats(statsData);
  };

  const handleViewDeliveryDetails = (delivery) => {
    setSelectedDelivery(delivery);
  };

  const handleBackToList = () => {
    setSelectedDelivery(null);
  };

  const handleDeliveryCreated = () => {
    setShowDeliveryForm(false);
    loadDeliveries();
    loadStats();
  };

  const handleDeleteDelivery = async (deliveryId: string) => {
    const success = await deleteDelivery(deliveryId);
    if (success) {
      loadDeliveries();
      loadStats();
    }
  };

  // Extract unique workshops for the filter
  const workshopOptions = [...new Set(deliveries.map(delivery => delivery.workshop_name).filter(Boolean))];

  // Filter deliveries based on tab, search query, and workshop
  const filteredDeliveries = deliveries.filter(delivery => {
    // Filter by tab
    if (activeTab !== 'all') {
      const statusMap = {
        'en-calidad': 'in_quality',
        'devuelto': 'rejected',
        'aprobado': 'approved'
      };
      const mappedStatus = statusMap[activeTab];
      if (mappedStatus && delivery.status !== mappedStatus) {
        return false;
      }
    }
    
    // Filter by search
    if (searchQuery && 
        !delivery.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !delivery.workshop_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !delivery.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filter by workshop
    if (selectedWorkshop !== 'all' && delivery.workshop_name !== selectedWorkshop) {
      return false;
    }
    
    return true;
  });

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <div className="w-2 h-2 rounded-full bg-gray-500 mr-1"></div>
            Pendiente
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
            En Tránsito
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
            Entregado
          </span>
        );
      case 'in_quality':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
            En Calidad
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
            Devuelto
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            Aprobado
          </span>
        );
      case 'partial_approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
            Parcialmente Aprobado
          </span>
        );
      default:
        return null;
    }
  };

  // If showing delivery details
  if (selectedDelivery) {
    return <DeliveryDetails delivery={selectedDelivery} onBack={handleBackToList} />;
  }

  if (loading && deliveries.length === 0) {
    return (
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <CheckCircle className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">Cargando entregas...</h3>
            <p className="text-gray-600">Por favor espera mientras cargamos los datos</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between text-gray-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Recepción & Calidad</h1>
          <p className="text-gray-600">Gestión de entregas, inspecciones y control de calidad</p>
        </div>
        <Button 
          onClick={() => setShowDeliveryForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Registrar Entrega
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-gray-600">Total Entregas</p>
          <p className="text-2xl font-bold">{stats.total_deliveries}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-blue-600">En Calidad</p>
          <p className="text-2xl font-bold text-blue-700">{stats.in_quality_deliveries}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-red-600">Devueltos</p>
          <p className="text-2xl font-bold text-red-700">{stats.rejected_deliveries}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-green-600">Aprobados</p>
          <p className="text-2xl font-bold text-green-700">{stats.approved_deliveries}</p>
        </Card>
      </div>

      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por orden o taller..." 
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="w-full lg:w-auto">
            <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Filtrar por taller" />
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
          
          <div className="w-full lg:w-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
              <TabsList className="grid grid-cols-4 w-full lg:w-auto">
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="en-calidad">En Calidad</TabsTrigger>
                <TabsTrigger value="devuelto">Devueltos</TabsTrigger>
                <TabsTrigger value="aprobado">Aprobados</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {filteredDeliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número de Seguimiento</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Cantidad Total</TableHead>
                  <TableHead>Aprobadas</TableHead>
                  <TableHead>Defectuosas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => {
                  return (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">{delivery.tracking_number}</TableCell>
                      <TableCell>{delivery.order_number}</TableCell>
                      <TableCell>{delivery.workshop_name}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{delivery.total_quantity} unidades</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-green-600">
                          {delivery.total_approved > 0 ? delivery.total_approved : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-red-600">
                          {delivery.total_defective > 0 ? delivery.total_defective : '-'}
                        </span>
                      </TableCell>
                      <TableCell>{renderStatusBadge(delivery.status)}</TableCell>
                      <TableCell>{new Date(delivery.delivery_date || delivery.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDeliveryDetails(delivery)}
                          >
                            Detalles
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Eliminar entrega?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente la entrega 
                                  <strong> {delivery.tracking_number}</strong> y todos sus datos relacionados.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteDelivery(delivery.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay entregas que coincidan</h3>
            <p className="text-gray-600 mb-4">Intenta ajustando los filtros o registra una nueva entrega</p>
            <Button 
              onClick={() => setShowDeliveryForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Registrar Entrega
            </Button>
          </div>
        )}
      </Card>

      {showDeliveryForm && (
        <DeliveryForm 
          onClose={() => setShowDeliveryForm(false)}
          onDeliveryCreated={handleDeliveryCreated}
        />
      )}
    </div>
  );
};

export default DeliveriesPage;
