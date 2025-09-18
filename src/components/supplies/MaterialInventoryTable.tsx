import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Warehouse, AlertTriangle } from 'lucide-react';
import { useMaterialInventory } from '@/hooks/useMaterialInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useState } from 'react';

const MaterialInventoryTable: React.FC = () => {
  const [selectedLocationType, setSelectedLocationType] = useState<'warehouse' | 'workshop' | 'all'>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  
  const { inventory, loading } = useMaterialInventory(
    selectedLocationId === 'all' ? undefined : selectedLocationId,
    selectedLocationType === 'all' ? undefined : selectedLocationType
  );
  const { warehouses } = useWarehouses();
  const { workshops } = useWorkshops();

  const getLocationOptions = () => {
    if (selectedLocationType === 'warehouse') {
      return warehouses.map(w => ({ value: w.id, label: w.name }));
    } else if (selectedLocationType === 'workshop') {
      return workshops.map(w => ({ value: w.id, label: w.name }));
    }
    return [];
  };

  const getStockStatus = (currentStock: number, reservedStock: number) => {
    const availableStock = currentStock - reservedStock;
    if (availableStock <= 0) {
      return { status: 'critical', color: 'text-red-600', bgColor: 'bg-red-50' };
    } else if (availableStock <= 5) {
      return { status: 'warning', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    }
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p>Cargando inventario...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Inventario por Ubicación
        </CardTitle>
        
        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Ubicación</label>
            <Select 
              value={selectedLocationType} 
              onValueChange={(value) => {
                setSelectedLocationType(value as 'warehouse' | 'workshop' | 'all');
                setSelectedLocationId('all');
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las ubicaciones</SelectItem>
                <SelectItem value="warehouse">Solo bodegas</SelectItem>
                <SelectItem value="workshop">Solo talleres</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedLocationType !== 'all' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Ubicación Específica</label>
              <Select 
                value={selectedLocationId} 
                onValueChange={setSelectedLocationId}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {getLocationOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {inventory.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No hay inventario en las ubicaciones seleccionadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Stock Reservado</TableHead>
                  <TableHead>Stock Disponible</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => {
                  const availableStock = item.current_stock - item.reserved_stock;
                  const stockStatus = getStockStatus(item.current_stock, item.reserved_stock);
                  
                  return (
                    <TableRow key={item.id} className={stockStatus.bgColor}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.material?.name}</div>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">
                              {item.material?.sku}
                            </Badge>
                            {item.material?.color && (
                              <Badge variant="secondary" className="text-xs">
                                {item.material?.color}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {item.material?.category}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{item.location_name}</div>
                          <Badge variant="outline" className="text-xs">
                            {item.location_type === 'warehouse' ? 'Bodega' : 'Taller'}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">
                          {item.current_stock} {item.material?.unit}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="font-medium">
                          {item.reserved_stock} {item.material?.unit}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className={`font-medium ${stockStatus.color}`}>
                          {availableStock} {item.material?.unit}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {stockStatus.status === 'critical' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                              <Badge variant="destructive">Sin stock</Badge>
                            </>
                          )}
                          {stockStatus.status === 'warning' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              <Badge variant="secondary">Stock bajo</Badge>
                            </>
                          )}
                          {stockStatus.status === 'good' && (
                            <Badge variant="default">Stock suficiente</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaterialInventoryTable;