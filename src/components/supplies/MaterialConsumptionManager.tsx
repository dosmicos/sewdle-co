
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import { supabase } from '@/integrations/supabase/client';

interface ConsumptionRecord {
  id: string;
  orderId?: string;
  materialId: string;
  materialName: string;
  materialColor: string;
  workshopId: string;
  workshopName: string;
  quantityConsumed: number;
  materialUnit: string;
  consumedDate: string;
  orderNumber: string;
}

const MaterialConsumptionManager = () => {
  const { workshopFilter, isWorkshopUser } = useUserContext();
  
  const [filters, setFilters] = useState({
    workshop: isWorkshopUser && workshopFilter ? workshopFilter : 'all'
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
      
      // Usar la nueva RPC para obtener consumos con el workshop correcto
      const { data: consumptionData, error } = await supabase
        .rpc('get_material_consumptions_by_order');

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

      // Procesar consumos con el workshop correcto obtenido de la asignación
      const consumptions: ConsumptionRecord[] = consumptionData.map(consumption => {
        console.log('Processing consumption:', {
          material: consumption.material_name,
          workshop: consumption.workshop_name,
          order: consumption.order_id,
          orderNumber: consumption.order_number,
          consumed: consumption.quantity_consumed
        });
        
        return {
          id: consumption.id,
          orderId: consumption.order_id || '',
          materialId: consumption.material_id,
          materialName: consumption.material_name || 'Material desconocido',
          materialColor: consumption.material_color || '',
          workshopId: consumption.workshop_id,
          workshopName: consumption.workshop_name || 'Sin asignar',
          quantityConsumed: Number(consumption.quantity_consumed),
          materialUnit: consumption.material_unit || 'unidad',
          consumedDate: consumption.created_at,
          orderNumber: consumption.order_number || 'Sin orden asignada'
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
    // Si es usuario de taller, solo mostrar consumos de su taller
    if (isWorkshopUser && workshopFilter && consumption.workshopId !== workshopFilter) {
      return false;
    }
    
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
              <Select 
                value={filters.workshop} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, workshop: value }))}
                disabled={isWorkshopUser} // Deshabilitar filtro para usuarios de taller
              >
                <SelectTrigger>
                  <SelectValue placeholder={isWorkshopUser ? "Tu taller" : "Todos los talleres"} />
                </SelectTrigger>
                <SelectContent>
                  {!isWorkshopUser && <SelectItem value="all">Todos los talleres</SelectItem>}
                  {workshops
                    .filter(workshop => !isWorkshopUser || workshop.id === workshopFilter)
                    .map((workshop) => (
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
                  <TableHead>Color</TableHead>
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
                    <TableCell>
                      {consumption.materialColor ? (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                          {consumption.materialColor}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin color</span>
                      )}
                    </TableCell>
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
