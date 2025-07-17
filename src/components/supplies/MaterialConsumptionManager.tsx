
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { supabase } from '@/integrations/supabase/client';

interface ConsumptionRecord {
  id: string;
  orderId?: string;
  materialId: string;
  materialName: string;
  workshopId: string;
  workshopName: string;
  quantityConsumed: number;
  materialUnit: string;
  consumedDate: string;
  orderNumber: string;
}

const MaterialConsumptionManager = () => {
  const [filters, setFilters] = useState({
    workshop: 'all'
  });
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { materialDeliveries, fetchMaterialDeliveries, loading: deliveriesLoading } = useMaterialDeliveries();

  useEffect(() => {
    loadConsumptionHistory();
  }, [fetchMaterialDeliveries]);

  const loadConsumptionHistory = async () => {
    try {
      setDataLoading(true);
      console.log('=== LOADING CONSUMPTION HISTORY ===');
      
      // Obtener consumos directamente con información de assignment
      const { data: consumptionData, error } = await supabase
        .from('material_deliveries')
        .select(`
          id,
          material_id,
          order_id,
          quantity_consumed,
          delivery_date,
          created_at,
          updated_at,
          materials (
            id,
            name,
            sku,
            unit,
            category,
            color
          ),
          orders (
            id,
            order_number,
            workshop_assignments (
              workshop_id,
              workshops (
                id,
                name
              )
            )
          )
        `)
        .gt('quantity_consumed', 0)
        .not('order_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading consumption history:', error);
        throw error;
      }

      console.log('Consumption data received:', consumptionData?.length || 0);
      
      if (!consumptionData || !Array.isArray(consumptionData)) {
        console.log('No consumption data available');
        setConsumptionHistory([]);
        return;
      }

      // Procesar consumos obteniendo el workshop desde la asignación de la orden
      const consumptions: ConsumptionRecord[] = consumptionData.map(consumption => {
        // Obtener workshop desde la asignación de la orden
        const orderAssignment = consumption.orders?.workshop_assignments?.[0];
        const assignedWorkshop = orderAssignment?.workshops;
        
        console.log('Processing consumption:', {
          material: consumption.materials?.name,
          workshop: assignedWorkshop?.name,
          order: consumption.order_id,
          orderNumber: consumption.orders?.order_number,
          consumed: consumption.quantity_consumed
        });
        
        return {
          id: consumption.id,
          orderId: consumption.order_id || '',
          materialId: consumption.material_id,
          materialName: consumption.materials?.name || 'Material desconocido',
          workshopId: orderAssignment?.workshop_id || '',
          workshopName: assignedWorkshop?.name || 'Sin asignar',
          quantityConsumed: Number(consumption.quantity_consumed),
          materialUnit: consumption.materials?.unit || 'unidad',
          consumedDate: consumption.created_at,
          orderNumber: consumption.orders?.order_number || 'Sin orden asignada'
        };
      });

      console.log('Processed consumptions:', consumptions.length, consumptions);
      setConsumptionHistory(consumptions);
    } catch (error) {
      console.error('Error loading consumption history:', error);
      setConsumptionHistory([]);
    } finally {
      setDataLoading(false);
    }
  };

  const filteredConsumptions = consumptionHistory.filter(consumption => {
    if (filters.workshop !== 'all' && consumption.workshopId !== filters.workshop) return false;
    return true;
  });

  const loading = workshopsLoading || deliveriesLoading || dataLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
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

      {/* Estadísticas de Consumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5" />
            <span>Resumen de Consumos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {filteredConsumptions.length}
              </div>
              <div className="text-sm text-blue-600">Registros de Consumo</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {filteredConsumptions.reduce((sum, c) => sum + c.quantityConsumed, 0)}
              </div>
              <div className="text-sm text-red-600">Total Consumido</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {[...new Set(filteredConsumptions.map(c => c.workshopId))].length}
              </div>
              <div className="text-sm text-green-600">Talleres Activos</div>
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
              <p className="text-gray-600">
                {consumptionHistory.length === 0 
                  ? 'Los consumos de materiales aparecerán aquí cuando se registren'
                  : 'No hay consumos que coincidan con los filtros seleccionados'
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Cantidad Consumida</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConsumptions.map((consumption) => (
                  <TableRow key={`${consumption.materialId}-${consumption.workshopId}`}>
                    <TableCell className="font-medium">{consumption.orderNumber}</TableCell>
                    <TableCell>{consumption.materialName}</TableCell>
                    <TableCell>{consumption.workshopName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-red-500 text-red-700">
                        -{consumption.quantityConsumed} {consumption.materialUnit}
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
