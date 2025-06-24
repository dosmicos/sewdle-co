
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, Calendar, Palette, AlertTriangle, CheckCircle } from 'lucide-react';
import MaterialDeliveryForm from './MaterialDeliveryForm';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

interface MaterialDeliveryWithBalance {
  id: string;
  material_id: string;
  workshop_id: string;
  order_id?: string;
  delivery_date: string;
  delivered_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  total_delivered: number;
  total_consumed: number;
  real_balance: number;
  material_name: string;
  material_sku: string;
  material_unit: string;
  material_color?: string;
  material_category: string;
  workshop_name: string;
  order_number?: string;
}

const MaterialDelivery = () => {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveries, setDeliveries] = useState<MaterialDeliveryWithBalance[]>([]);
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
  const workshopOptions = [...new Set(deliveries.map(d => d.workshop_name).filter(Boolean))];

  // Filter deliveries
  const filteredDeliveries = deliveries.filter(delivery => {
    // Search filter - includes color, material name, SKU, workshop
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        delivery.material_name?.toLowerCase().includes(searchLower) ||
        delivery.material_sku?.toLowerCase().includes(searchLower) ||
        delivery.material_color?.toLowerCase().includes(searchLower) ||
        delivery.workshop_name?.toLowerCase().includes(searchLower) ||
        delivery.order_number?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Workshop filter
    if (filterWorkshop !== 'all' && delivery.workshop_name !== filterWorkshop) {
      return false;
    }

    // Period filter
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

  const getBalanceStatus = (balance: number) => {
    if (balance > 0) {
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        className: 'bg-green-100 text-green-800',
        label: 'Disponible'
      };
    } else if (balance === 0) {
      return {
        icon: <Package className="w-4 h-4" />,
        className: 'bg-gray-100 text-gray-800',
        label: 'Consumido'
      };
    } else {
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        className: 'bg-red-100 text-red-800',
        label: 'Déficit'
      };
    }
  };

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
              placeholder="Buscar por material, color, taller u orden..."
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
                  <TableHead>Material y Color</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Total Entregado</TableHead>
                  <TableHead>Total Consumido</TableHead>
                  <TableHead>Balance Real</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Última Entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => {
                  const balanceStatus = getBalanceStatus(delivery.real_balance);
                  return (
                    <TableRow key={`${delivery.material_id}-${delivery.workshop_id}`}>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="font-medium text-black">
                            {delivery.material_name || 'N/A'}
                          </div>
                          <div className="flex items-center space-x-2">
                            {delivery.material_color && (
                              <Badge 
                                variant="outline" 
                                className="flex items-center space-x-1 bg-blue-50 text-blue-700 border-blue-200"
                              >
                                <Palette className="w-3 h-3" />
                                <span>{delivery.material_color}</span>
                              </Badge>
                            )}
                            {delivery.material_category && (
                              <span className="text-sm text-gray-600">
                                {delivery.material_category}
                              </span>
                            )}
                          </div>
                          {!delivery.material_color && (
                            <span className="text-xs text-gray-500 italic">
                              Sin color especificado
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {delivery.material_sku || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{delivery.workshop_name || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        {delivery.order_number ? (
                          <span className="font-medium">{delivery.order_number}</span>
                        ) : (
                          <span className="text-gray-500 italic">Sin orden asignada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-blue-600">
                          {delivery.total_delivered} {delivery.material_unit || ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-orange-600">
                          {delivery.total_consumed} {delivery.material_unit || ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${
                          delivery.real_balance > 0 ? 'text-green-600' : 
                          delivery.real_balance === 0 ? 'text-gray-600' : 'text-red-600'
                        }`}>
                          {delivery.real_balance} {delivery.material_unit || ''}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${balanceStatus.className} flex items-center space-x-1`}>
                          {balanceStatus.icon}
                          <span>{balanceStatus.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{new Date(delivery.delivery_date).toLocaleDateString()}</span>
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
