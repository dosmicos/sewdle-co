
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, AlertTriangle, Package, Truck } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

interface Supply {
  materialId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface SuppliesManagerProps {
  supplies: Supply[];
  onSuppliesChange: (supplies: Supply[]) => void;
  selectedWorkshop?: string;
  onCreateDelivery?: (materials: Supply[]) => void;
}

const SuppliesManager = ({ supplies, onSuppliesChange, selectedWorkshop, onCreateDelivery }: SuppliesManagerProps) => {
  const [workshopStock, setWorkshopStock] = useState<Record<string, number>>({});
  const [missingMaterials, setMissingMaterials] = useState<Supply[]>([]);
  const { materials, loading: materialsLoading } = useMaterials();
  const { fetchMaterialDeliveries } = useMaterialDeliveries();

  useEffect(() => {
    if (selectedWorkshop) {
      loadWorkshopStock();
    }
  }, [selectedWorkshop]);

  useEffect(() => {
    if (selectedWorkshop && supplies.length > 0) {
      checkMaterialAvailability();
    }
  }, [supplies, workshopStock, selectedWorkshop]);

  const loadWorkshopStock = async () => {
    if (!selectedWorkshop) return;
    
    try {
      const deliveries = await fetchMaterialDeliveries();
      const stock: Record<string, number> = {};
      
      // Calcular stock disponible por material en el taller seleccionado
      deliveries
        .filter(delivery => delivery.workshop_id === selectedWorkshop)
        .forEach(delivery => {
          const materialId = delivery.material_id;
          const available = delivery.quantity_remaining || 0;
          stock[materialId] = (stock[materialId] || 0) + available;
        });
      
      setWorkshopStock(stock);
    } catch (error) {
      console.error('Error loading workshop stock:', error);
    }
  };

  const checkMaterialAvailability = () => {
    const missing: Supply[] = [];
    
    supplies.forEach(supply => {
      const availableStock = workshopStock[supply.materialId] || 0;
      if (availableStock < supply.quantity) {
        missing.push({
          ...supply,
          quantity: supply.quantity - availableStock
        });
      }
    });
    
    setMissingMaterials(missing);
  };

  const addSupply = () => {
    onSuppliesChange([...supplies, { materialId: '', quantity: 0, unit: '', notes: '' }]);
  };

  const removeSupply = (index: number) => {
    if (supplies.length > 1) {
      onSuppliesChange(supplies.filter((_, i) => i !== index));
    }
  };

  const updateSupply = (index: number, field: keyof Supply, value: string | number) => {
    const updated = [...supplies];
    updated[index] = { ...updated[index], [field]: value };
    
    // Actualizar unidad automáticamente al seleccionar material
    if (field === 'materialId') {
      const selectedMaterial = materials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    onSuppliesChange(updated);
  };

  const getStockStatus = (materialId: string, requiredQuantity: number) => {
    const availableStock = workshopStock[materialId] || 0;
    const material = materials.find(m => m.id === materialId);
    
    if (availableStock >= requiredQuantity) {
      return { status: 'sufficient', color: 'green', text: `${availableStock} ${material?.unit} disponibles` };
    } else if (availableStock > 0) {
      return { status: 'partial', color: 'yellow', text: `Solo ${availableStock} de ${requiredQuantity} ${material?.unit}` };
    } else {
      return { status: 'insufficient', color: 'red', text: `0 ${material?.unit} disponibles` };
    }
  };

  const handleCreateDeliveryForMissing = () => {
    if (onCreateDelivery && missingMaterials.length > 0) {
      onCreateDelivery(missingMaterials);
    }
  };

  if (materialsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Package className="w-8 h-8 text-gray-400 animate-pulse mr-2" />
        <span className="text-gray-600">Cargando materiales...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alertas de materiales faltantes */}
      {selectedWorkshop && missingMaterials.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <strong>Materiales insuficientes en el taller:</strong>
                <ul className="mt-1 text-sm">
                  {missingMaterials.map((material, index) => {
                    const mat = materials.find(m => m.id === material.materialId);
                    return (
                      <li key={index}>
                        • {mat?.name}: faltan {material.quantity} {material.unit}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <Button
                onClick={handleCreateDeliveryForMissing}
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                <Truck className="w-4 h-4 mr-1" />
                Crear Entrega
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h4 className="font-medium text-black">Materiales Necesarios</h4>
        <Button
          type="button"
          variant="outline"
          onClick={addSupply}
          className="border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Material
        </Button>
      </div>

      <div className="space-y-4">
        {supplies.map((supply, index) => {
          const selectedMaterial = materials.find(m => m.id === supply.materialId);
          const stockStatus = selectedWorkshop && supply.materialId ? 
            getStockStatus(supply.materialId, supply.quantity) : null;
          
          return (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h5 className="font-medium text-black">Material #{index + 1}</h5>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSupply(index)}
                  className="text-red-500 hover:text-red-700"
                  disabled={supplies.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Material *
                  </label>
                  <Select
                    value={supply.materialId}
                    onValueChange={(value) => updateSupply(index, 'materialId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar material..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{material.name} ({material.sku})</span>
                            {selectedWorkshop && (
                              <Badge variant="outline" className="ml-2">
                                {workshopStock[material.id] || 0} {material.unit}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Cantidad *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={supply.quantity || ''}
                    onChange={(e) => updateSupply(index, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Unidad
                  </label>
                  <Input
                    value={supply.unit}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Selecciona un material"
                  />
                </div>
              </div>

              {/* Estado del stock en el taller */}
              {selectedWorkshop && stockStatus && supply.materialId && (
                <div className="mt-3">
                  <div className={`p-2 rounded-lg border text-sm ${
                    stockStatus.status === 'sufficient' ? 'bg-green-50 border-green-200 text-green-800' :
                    stockStatus.status === 'partial' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                    'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      <span className="font-medium">Stock en taller:</span>
                      <span className="ml-2">{stockStatus.text}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Información del material seleccionado */}
              {selectedMaterial && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-700">
                    <div><strong>Categoría:</strong> {selectedMaterial.category}</div>
                    {selectedMaterial.color && (
                      <div><strong>Color:</strong> {selectedMaterial.color}</div>
                    )}
                    {selectedMaterial.supplier && (
                      <div><strong>Proveedor:</strong> {selectedMaterial.supplier}</div>
                    )}
                    <div><strong>Stock Global:</strong> {selectedMaterial.current_stock} {selectedMaterial.unit}</div>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-black mb-2">
                  Notas
                </label>
                <Input
                  value={supply.notes || ''}
                  onChange={(e) => updateSupply(index, 'notes', e.target.value)}
                  placeholder="Especificaciones adicionales..."
                />
              </div>
            </Card>
          );
        })}
      </div>

      {supplies.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600 mb-4">No hay materiales agregados</p>
          <Button
            type="button"
            variant="outline"
            onClick={addSupply}
            className="border-dashed"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Material
          </Button>
        </div>
      )}
    </div>
  );
};

export default SuppliesManager;
