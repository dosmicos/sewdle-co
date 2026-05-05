
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package, Warehouse, Loader2 } from 'lucide-react';

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

interface WorkshopInventoryTableProps {
  deliveries: MaterialDeliveryWithBalance[];
}

const WorkshopInventoryTable: React.FC<WorkshopInventoryTableProps> = ({ deliveries }) => {
  const workshopInventory = useMemo(() => {
    try {
      console.log('Processing deliveries for inventory table:', deliveries?.length || 0);
      
      if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
        console.log('No deliveries data provided to WorkshopInventoryTable');
        return {};
      }

      const inventory: Record<string, {
        workshopName: string;
        materials: Array<{
          materialId: string;
          materialName: string;
          sku: string;
          color?: string;
          category: string;
          unit: string;
          totalDelivered: number;
          totalConsumed: number;
          remaining: number;
        }>;
      }> = {};

      // Agrupar por taller y material
      deliveries.forEach(delivery => {
        try {
          const workshopId = delivery.workshop_id;
          const materialId = delivery.material_id;

          if (!workshopId || !materialId) {
            console.warn('Invalid delivery data - missing workshop_id or material_id:', delivery);
            return;
          }

          if (!inventory[workshopId]) {
            inventory[workshopId] = {
              workshopName: delivery.workshop_name || 'Taller sin nombre',
              materials: []
            };
          }

          // Buscar si ya existe este material para este taller
          const existingMaterial = inventory[workshopId].materials.find(
            m => m.materialId === materialId
          );

          const totalDelivered = Number(delivery.total_delivered) || 0;
          const totalConsumed = Number(delivery.total_consumed) || 0;
          const remaining = Number(delivery.real_balance) || 0;

          if (!existingMaterial) {
            inventory[workshopId].materials.push({
              materialId,
              materialName: delivery.material_name || 'Material sin nombre',
              sku: delivery.material_sku || 'N/A',
              color: delivery.material_color,
              category: delivery.material_category || 'Sin categoría',
              unit: delivery.material_unit || 'unidad',
              totalDelivered,
              totalConsumed,
              remaining
            });
          } else {
            // Si ya existe, actualizar cantidades (en caso de múltiples entregas)
            existingMaterial.totalDelivered += totalDelivered;
            existingMaterial.totalConsumed += totalConsumed;
            existingMaterial.remaining += remaining;
          }
        } catch (error) {
          console.error('Error processing delivery item:', delivery, error);
        }
      });

      // Ordenar materiales por nombre dentro de cada taller
      Object.values(inventory).forEach(workshop => {
        if (workshop.materials && Array.isArray(workshop.materials)) {
          workshop.materials.sort((a, b) => 
            (a.materialName || '').localeCompare(b.materialName || '')
          );
        }
      });

      console.log('Processed inventory for', Object.keys(inventory).length, 'workshops');
      return inventory;
    } catch (error) {
      console.error('Error processing workshop inventory:', error);
      return {};
    }
  }, [deliveries]);

  const getStockBadgeVariant = (remaining: number): "default" | "destructive" | "outline" | "secondary" => {
    if (remaining <= 0) return 'destructive';
    if (remaining <= 10) return 'outline';
    return 'default';
  };

  const getStockStatusText = (remaining: number) => {
    if (remaining <= 0) return 'Sin stock';
    if (remaining <= 10) return 'Stock bajo';
    return 'Disponible';
  };

  // Loading state
  if (!deliveries) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5" />
            <span>Inventario por Taller</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Cargando inventario...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (Object.keys(workshopInventory).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5" />
            <span>Inventario por Taller</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay datos de inventario disponibles</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-black flex items-center space-x-2">
        <Warehouse className="w-5 h-5" />
        <span>Inventario por Taller</span>
      </h3>
      
      {Object.entries(workshopInventory).map(([workshopId, workshop]) => (
        <Card key={workshopId}>
          <CardHeader>
            <CardTitle className="text-base font-medium text-black">
              {workshop.workshopName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!workshop.materials || workshop.materials.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-600">No hay materiales disponibles en este taller</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Total Entregado</TableHead>
                    <TableHead className="text-right">Total Consumido</TableHead>
                    <TableHead className="text-right">Restante</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workshop.materials.map((material) => (
                    <TableRow key={material.materialId}>
                      <TableCell className="font-medium">
                        {material.materialName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {material.sku}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {material.color ? (
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: material.color.toLowerCase() }}
                              title={material.color}
                            />
                            <span className="text-sm">{material.color}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {material.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-blue-600">
                          +{material.totalDelivered}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          {material.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-red-600">
                          -{material.totalConsumed}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          {material.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-black">
                          {material.remaining}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          {material.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStockBadgeVariant(material.remaining)}>
                          {getStockStatusText(material.remaining)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default WorkshopInventoryTable;
