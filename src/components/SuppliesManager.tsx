
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface SuppliesManagerProps {
  supplies: any[];
  onSuppliesChange: (supplies: any[]) => void;
}

const SuppliesManager = ({ supplies, onSuppliesChange }: SuppliesManagerProps) => {
  // Diccionario de materiales disponibles
  const availableMaterials = [
    {
      id: 'TEL001',
      name: 'Tela Algodón Premium',
      sku: 'TEL001',
      unit: 'metros',
      category: 'Telas'
    },
    {
      id: 'AVI001',
      name: 'Botones Plásticos',
      sku: 'AVI001',
      unit: 'unidades',
      category: 'Avíos'
    },
    {
      id: 'ETI001',
      name: 'Etiquetas Marca',
      sku: 'ETI001',
      unit: 'unidades',
      category: 'Etiquetas'
    },
    {
      id: 'HIL001',
      name: 'Hilo Algodón',
      sku: 'HIL001',
      unit: 'rollos',
      category: 'Hilos'
    },
    {
      id: 'CRE001',
      name: 'Cremalleras 15cm',
      sku: 'CRE001',
      unit: 'unidades',
      category: 'Cremalleras'
    }
  ];

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
      const selectedMaterial = availableMaterials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    onSuppliesChange(updated);
  };

  const getSelectedMaterial = (materialId: string) => {
    return availableMaterials.find(m => m.id === materialId);
  };

  return (
    <div className="space-y-6">
      {supplies.map((supply, index) => {
        const selectedMaterial = getSelectedMaterial(supply.materialId);
        
        return (
          <div key={supply.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-black">Insumo #{index + 1}</h4>
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
                    {availableMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.sku} - {material.name}
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
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-black">{selectedMaterial.name}</div>
                    <div className="text-sm text-gray-600">SKU: {selectedMaterial.sku}</div>
                    <div className="text-sm text-gray-600">Categoría: {selectedMaterial.category}</div>
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
