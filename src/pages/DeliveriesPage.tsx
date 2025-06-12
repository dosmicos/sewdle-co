import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DeliveryForm from '@/components/DeliveryForm';
import DeliveryDetails from '@/components/DeliveryDetails';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Mock data for deliveries
const mockDeliveries = [
  {
    id: 'ORD-123-E1',
    orderId: 'ORD-123',
    workshop: 'Taller Central',
    deliveryNumber: 1,
    percentageDelivered: 60,
    status: 'en-calidad',
    date: '2023-06-10T10:30:00'
  },
  {
    id: 'ORD-125-E1',
    orderId: 'ORD-125',
    workshop: 'Textiles Norte',
    deliveryNumber: 1,
    percentageDelivered: 100,
    status: 'aprobado',
    date: '2023-06-09T14:20:00'
  },
  {
    id: 'ORD-124-E2',
    orderId: 'ORD-124',
    workshop: 'Costura Rápida',
    deliveryNumber: 2,
    percentageDelivered: 40,
    status: 'devuelto',
    date: '2023-06-08T09:15:00'
  }
];

// Extract unique workshops for the filter
const workshopOptions = [...new Set(mockDeliveries.map(delivery => delivery.workshop))];

const DeliveriesPage = () => {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedWorkshop, setSelectedWorkshop] = useState('all');

  const handleViewDeliveryDetails = (delivery) => {
    setSelectedDelivery(delivery);
  };

  const handleBackToList = () => {
    setSelectedDelivery(null);
  };

  // Filter deliveries based on tab, search query, and workshop
  const filteredDeliveries = mockDeliveries.filter(delivery => {
    // Filter by tab
    if (activeTab !== 'all' && delivery.status !== activeTab) {
      return false;
    }
    
    // Filter by search
    if (searchQuery && 
        !delivery.orderId.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !delivery.workshop.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filter by workshop
    if (selectedWorkshop !== 'all' && delivery.workshop !== selectedWorkshop) {
      return false;
    }
    
    return true;
  });

  // Count deliveries by status
  const counts = {
    total: mockDeliveries.length,
    enCalidad: mockDeliveries.filter(d => d.status === 'en-calidad').length,
    devuelto: mockDeliveries.filter(d => d.status === 'devuelto').length,
    aprobado: mockDeliveries.filter(d => d.status === 'aprobado').length,
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'en-calidad':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
            En Calidad
          </span>
        );
      case 'devuelto':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
            Devuelto
          </span>
        );
      case 'aprobado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
            Aprobado
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
          <p className="text-2xl font-bold">{counts.total}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-blue-600">En Calidad</p>
          <p className="text-2xl font-bold text-blue-700">{counts.enCalidad}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-red-600">Devuelto</p>
          <p className="text-2xl font-bold text-red-700">{counts.devuelto}</p>
        </Card>
        <Card className="p-4 shadow-sm border-gray-200">
          <p className="text-sm font-medium text-green-600">Aprobado</p>
          <p className="text-2xl font-bold text-green-700">{counts.aprobado}</p>
        </Card>
      </div>

      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center space-y-2 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por orden o taller..." 
              className="w-full pl-15 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
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
                  <TableHead>Orden</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Entrega #</TableHead>
                  <TableHead>% Entregado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium">{delivery.orderId}</TableCell>
                    <TableCell>{delivery.workshop}</TableCell>
                    <TableCell>{delivery.deliveryNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="h-2 rounded-full bg-blue-500" 
                            style={{ width: `${delivery.percentageDelivered}%` }}
                          ></div>
                        </div>
                        <span className="text-sm">{delivery.percentageDelivered}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{renderStatusBadge(delivery.status)}</TableCell>
                    <TableCell>{new Date(delivery.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDeliveryDetails(delivery)}
                      >
                        Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
        <DeliveryForm onClose={() => setShowDeliveryForm(false)} />
      )}
    </div>
  );
};

export default DeliveriesPage;
