
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SuppliesManagerProps {
  supplies: any[];
  onSuppliesChange: (supplies: any[]) => void;
}

interface Material {
  id: string;
  name: string;
  sku: string;
  unit: string;
  category: string;
  description?: string;
}

const SuppliesManager = ({ supplies, onSuppliesChange }: SuppliesManagerProps) => {
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      
      const { data: materials, error } = await supabase
        .from('materials')
        .select('id, name, sku, unit, category, description')
        .order('name');

      if (error) {
        console.error('Error fetching materials:', error);
        return;
      }

      console.log('Fetched materials from database:', materials);
      setAvailableMaterials(materials || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Cargando materiales...</p>
      </div>
    );
  }

  if (availableMaterials.length === 0) {
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
                    {selectedMaterial.description && (
                      <div className="text-sm text-gray-600 mt-1">{selectedMaterial.description}</div>
                    )}
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
