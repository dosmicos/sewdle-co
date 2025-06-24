
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

const MaterialConsumptionManager = () => {
  const [filters, setFilters] = useState({
    workshop: 'all'
  });
  const [consumptionHistory, setConsumptionHistory] = useState<any[]>([]);

  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { fetchMaterialDeliveries, loading: deliveriesLoading } = useMaterialDeliveries();

  useEffect(() => {
    loadConsumptionHistory();
  }, []);

  const loadConsumptionHistory = async () => {
    try {
      const deliveries = await fetchMaterialDeliveries();
      console.log('Deliveries data received:', deliveries);
      
      // CORRECCIÓN: Procesar solo registros que tienen consumo registrado (total_consumed > 0)
      const consumptions = deliveries
        .filter(delivery => delivery.total_consumed > 0)
        .map(delivery => {
          console.log('Processing consumption:', delivery);
          
          return {
            id: delivery.id,
            orderId: delivery.order_id,
            materialId: delivery.material_id,
            materialName: delivery.material_name || 'Material desconocido',
            workshopId: delivery.workshop_id,
            workshopName: delivery.workshop_name || 'Taller desconocido',
            quantityConsumed: delivery.total_consumed,
            consumedDate: delivery.updated_at,
            orderNumber: delivery.order_number || 'Sin orden asignada'
          };
        });

      console.log('Processed consumptions:', consumptions);
      setConsumptionHistory(consumptions);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      setConsumptionHistory([]);
    }
  };

  const filteredConsumptions = consumptionHistory.filter(consumption => {
    if (filters.workshop !== 'all' && consumption.workshopId !== filters.workshop) return false;
    return true;
  });

  const loading = workshopsLoading || deliveriesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2 text-black">Cargando datos de consumo...</h3>
          <p className="text-gray-600">Obteniendo información de consumos de materiales</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Filtros de Consumo</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Taller</label>
              <Select value={filters.workshop} onValueChange={(value) => setFilters(prev => ({ ...prev, workshop: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de Consumos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Historial de Consumos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredConsumptions.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay consumos registrados</h3>
              <p className="text-gray-600">Los consumos de materiales aparecerán aquí cuando se registren</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsumptions.map((consumption) => (
                  <TableRow key={consumption.id}>
                    <TableCell className="font-medium">{consumption.orderNumber}</TableCell>
                    <TableCell>{consumption.materialName}</TableCell>
                    <TableCell>{consumption.workshopName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-red-500 text-red-700">
                        -{consumption.quantityConsumed}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(consumption.consumedDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialConsumptionManager;
