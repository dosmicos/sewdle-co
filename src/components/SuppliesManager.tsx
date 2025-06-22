import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';

interface SuppliesManagerProps {
  supplies: any[];
  onSuppliesChange: (supplies: any[]) => void;
}

// Helper function to format material display text
const formatMaterialDisplay = (material: any) => {
  const baseText = `${material.sku} - ${material.name}`;
  return material.color ? `${baseText} (${material.color})` : baseText;
};

// Helper function to get color indicator
const getColorIndicator = (color: string | null) => {
  if (!color) return null;
  
  const colorMap: Record<string, string> = {
    'rojo': '#ef4444',
    'azul': '#3b82f6',
    'verde': '#10b981',
    'amarillo': '#f59e0b',
    'negro': '#000000',
    'blanco': '#ffffff',
    'gris': '#6b7280',
    'rosa': '#ec4899',
    'morado': '#8b5cf6',
    'naranja': '#f97316',
    'café': '#a16207',
    'beige': '#d6d3d1',
    'crema': '#fef3c7'
  };
  
  const colorValue = colorMap[color.toLowerCase()] || '#9ca3af';
  
  return (
    <span 
      className="inline-block w-3 h-3 rounded-full border border-gray-300 mr-2" 
      style={{ backgroundColor: colorValue }}
    />
  );
};

const SuppliesManager = ({ supplies, onSuppliesChange }: SuppliesManagerProps) => {
  const { materials, loading } = useMaterials();
  const [availability, setAvailability] = useState<Record<string, any>>({});

  // Update availability when supplies or materials change
  useEffect(() => {
    const newAvailability: Record<string, any> = {};
    
    supplies.forEach((supply, index) => {
      if (supply.materialId) {
        const material = materials.find(m => m.id === supply.materialId);
        if (material) {
          const available = material.current_stock || 0;
          const sufficient = available >= supply.quantity;
          const isLowStock = available <= (material.min_stock_alert || 0);
          
          newAvailability[index] = {
            available,
            sufficient,
            isLowStock,
            material
          };
        }
      }
    });
    
    setAvailability(newAvailability);
  }, [supplies, materials]);

  const addSupply = () => {
    const newSupply = {
      id: Date.now().toString(),
      materialId: '',
      quantity: 0,
      unit: '',
      notes: ''
    };
    onSuppliesChange([...supplies, newSupply]);
  };

  const removeSupply = (index: number) => {
    const updated = supplies.filter((_, i) => i !== index);
    onSuppliesChange(updated);
  };

  const updateSupply = (index: number, field: string, value: any) => {
    const updated = [...supplies];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se cambia el material, actualizar automáticamente la unidad
    if (field === 'materialId') {
      const selectedMaterial = materials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    onSuppliesChange(updated);
  };

  const getSelectedMaterial = (materialId: string) => {
    return materials.find(m => m.id === materialId);
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Cargando materiales...</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">No hay materiales disponibles. Crea materiales primero en la sección de Insumos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {supplies.map((supply, index) => {
        const selectedMaterial = getSelectedMaterial(supply.materialId);
        const availabilityInfo = availability[index];
        
        return (
          <div key={supply.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-black">Insumo #{index + 1}</h4>
              <div className="flex items-center space-x-2">
                {availabilityInfo && (
                  <div className="flex items-center space-x-1">
                    {availabilityInfo.sufficient ? (
                      availabilityInfo.isLowStock ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={`text-xs ${
                      availabilityInfo.sufficient 
                        ? availabilityInfo.isLowStock ? 'text-yellow-600' : 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Stock: {availabilityInfo.available} {selectedMaterial?.unit}
                    </span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSupply(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Material
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
                          <div className="flex items-center">
                            {getColorIndicator(material.color)}
                            <span>{formatMaterialDisplay(material)}</span>
                          </div>
                          <span className="text-xs text-gray-500 ml-2">
                            Stock: {material.current_stock} {material.unit}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Cantidad Necesaria
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={supply.quantity || ''}
                  onChange={(e) => updateSupply(index, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className={availabilityInfo && !availabilityInfo.sufficient ? 'border-red-300' : ''}
                />
                {availabilityInfo && !availabilityInfo.sufficient && (
                  <p className="text-red-500 text-xs mt-1">
                    Stock insuficiente (disponible: {availabilityInfo.available} {selectedMaterial?.unit})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Unidad
                </label>
                <Input
                  value={supply.unit}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Selecciona material"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Categoría
                </label>
                <Input
                  value={selectedMaterial?.category || ''}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Selecciona material"
                />
              </div>
            </div>

            {selectedMaterial && (
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Descripción del Material
                  </label>
                  <div className={`p-3 rounded-lg ${
                    availabilityInfo 
                      ? availabilityInfo.sufficient 
                        ? 'bg-green-50 border border-green-200' 
                        : 'bg-red-50 border border-red-200'
                      : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        {getColorIndicator(selectedMaterial.color)}
                        <div className="font-medium text-black">{selectedMaterial.name}</div>
                      </div>
                      {availabilityInfo && (
                        <div className="flex items-center space-x-1">
                          {availabilityInfo.sufficient ? (
                            availabilityInfo.isLowStock ? (
                              <>
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                <span className="text-yellow-600 text-sm font-medium">Stock Bajo</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                <span className="text-green-600 text-sm font-medium">Disponible</span>
                              </>
                            )
                          ) : (
                            <>
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-red-600 text-sm font-medium">Insuficiente</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">SKU: {selectedMaterial.sku}</div>
                    <div className="text-sm text-gray-600">Categoría: {selectedMaterial.category}</div>
                    {selectedMaterial.color && (
                      <div className="text-sm text-gray-600">Color: {selectedMaterial.color}</div>
                    )}
                    {selectedMaterial.description && (
                      <div className="text-sm text-gray-600 mt-1">{selectedMaterial.description}</div>
                    )}
                    {selectedMaterial.supplier && (
                      <div className="text-sm text-gray-600">Proveedor: {selectedMaterial.supplier}</div>
                    )}
                    <div className="text-sm font-medium mt-2">
                      Stock actual: 
                      <span className={`ml-1 ${
                        availabilityInfo 
                          ? availabilityInfo.sufficient 
                            ? availabilityInfo.isLowStock ? 'text-yellow-600' : 'text-green-600'
                            : 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {selectedMaterial.current_stock} {selectedMaterial.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Notas Especiales
                  </label>
                  <Input
                    value={supply.notes || ''}
                    onChange={(e) => updateSupply(index, 'notes', e.target.value)}
                    placeholder="Especificaciones adicionales, color específico, etc."
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addSupply}
        className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:text-black hover:border-gray-400"
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Insumo
      </Button>
    </div>
  );
};

export default SuppliesManager;
