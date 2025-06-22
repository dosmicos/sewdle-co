
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Package, Calendar, User } from 'lucide-react';
import MaterialDeliveryForm from './MaterialDeliveryForm';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

const MaterialDelivery = () => {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWorkshop, setFilterWorkshop] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const { fetchMaterialDeliveries, loading } = useMaterialDeliveries();

  useEffect(() => {
    loadDeliveries();
  }, []);

  const loadDeliveries = async () => {
    const data = await fetchMaterialDeliveries();
    setDeliveries(data);
  };

  const handleDeliveryCreated = () => {
    setShowDeliveryForm(false);
    loadDeliveries();
  };

  // Extract unique workshops for filter
  const workshopOptions = [...new Set(deliveries.map(d => d.workshops?.name).filter(Boolean))];

  // Filter deliveries
  const filteredDeliveries = deliveries.filter(delivery => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        delivery.materials?.name?.toLowerCase().includes(searchLower) ||
        delivery.materials?.sku?.toLowerCase().includes(searchLower) ||
        delivery.workshops?.name?.toLowerCase().includes(searchLower) ||
        delivery.orders?.order_number?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Workshop filter
    if (filterWorkshop !== 'all' && delivery.workshops?.name !== filterWorkshop) {
      return false;
    }

    // Period filter (could be expanded)
    if (filterPeriod !== 'all') {
      const deliveryDate = new Date(delivery.delivery_date);
      const now = new Date();
      
      switch (filterPeriod) {
        case 'today':
          if (deliveryDate.toDateString() !== now.toDateString()) return false;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (deliveryDate < weekAgo) return false;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (deliveryDate < monthAgo) return false;
          break;
      }
    }

    return true;
  });

  if (loading && deliveries.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">Cargando entregas...</h3>
            <p className="text-gray-600">Por favor espera mientras cargamos los datos</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por material, taller u orden..."
              className="w-80 pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={filterWorkshop} onValueChange={setFilterWorkshop}>
            <SelectTrigger className="w-48">
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

          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los períodos</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={() => setShowDeliveryForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Entrega
        </Button>
      </div>

      <Card className="p-6">
        {filteredDeliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Taller Destino</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Consumido</TableHead>
                  <TableHead>Restante</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-black">
                          {delivery.materials?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {delivery.materials?.category || ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {delivery.materials?.sku || 'N/A'}
                    </TableCell>
                    <TableCell>{delivery.workshops?.name || 'N/A'}</TableCell>
                    <TableCell>
                      {delivery.orders?.order_number ? (
                        <span className="font-medium">{delivery.orders.order_number}</span>
                      ) : (
                        <span className="text-gray-500 italic">Sin orden asignada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {delivery.quantity_delivered} {delivery.materials?.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-orange-600">
                        {delivery.quantity_consumed || 0} {delivery.materials?.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600">
                        {delivery.quantity_remaining} {delivery.materials?.unit || ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span>{new Date(delivery.delivery_date).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        delivery.quantity_remaining > 0 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {delivery.quantity_remaining > 0 ? 'Disponible' : 'Consumido'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">
              {deliveries.length === 0 ? 'No hay entregas registradas' : 'No hay entregas que coincidan'}
            </h3>
            <p className="text-gray-600 mb-4">
              {deliveries.length === 0 
                ? 'Comienza registrando la primera entrega de materiales'
                : 'Intenta ajustando los filtros de búsqueda'
              }
            </p>
            <Button 
              onClick={() => setShowDeliveryForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {deliveries.length === 0 ? 'Registrar Primera Entrega' : 'Nueva Entrega'}
            </Button>
          </div>
        )}
      </Card>

      {showDeliveryForm && (
        <MaterialDeliveryForm 
          onClose={() => setShowDeliveryForm(false)}
          onDeliveryCreated={handleDeliveryCreated}
        />
      )}
    </div>
  );
};

export default MaterialDelivery;
