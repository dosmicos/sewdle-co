import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableMaterialSelector from '@/components/supplies/SearchableMaterialSelector';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkshopMaterial {
  id: string;
  material_id: string;
  material_name: string;
  material_sku: string;
  material_color: string | null;
  material_unit: string;
  real_balance: number;
}

interface SelectedMaterial {
  id: string;
  name: string;
  sku: string;
  color: string | null;
  unit: string;
  quantity: number;
  available: number;
}

interface WorkshopMaterialSelectorProps {
  workshopId: string;
  selectedMaterials: SelectedMaterial[];
  onMaterialsChange: (materials: SelectedMaterial[]) => void;
}

const WorkshopMaterialSelector = ({ 
  workshopId, 
  selectedMaterials, 
  onMaterialsChange 
}: WorkshopMaterialSelectorProps) => {
  const [availableMaterials, setAvailableMaterials] = useState<WorkshopMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchWorkshopMaterials = async () => {
    if (!workshopId) return;
    
    setLoading(true);
    try {
      // Obtener materiales disponibles en el taller específico
      const { data, error } = await supabase
        .rpc('get_material_deliveries_with_real_balance');

      if (error) throw error;

      // Filtrar solo materiales del taller específico con stock positivo
      const workshopMaterials = data
        ?.filter((delivery: any) => 
          delivery.workshop_id === workshopId && delivery.real_balance > 0
        )
        .map((delivery: any) => ({
          id: delivery.material_id,
          material_id: delivery.material_id,
          material_name: delivery.material_name,
          material_sku: delivery.material_sku,
          material_color: delivery.material_color,
          material_unit: delivery.material_unit,
          real_balance: delivery.real_balance
        })) || [];

      // Eliminar duplicados por material_id y sumar balances
      const uniqueMaterials = workshopMaterials.reduce((acc: WorkshopMaterial[], current: WorkshopMaterial) => {
        const existing = acc.find(item => item.material_id === current.material_id);
        if (existing) {
          existing.real_balance += current.real_balance;
        } else {
          acc.push(current);
        }
        return acc;
      }, []);

      setAvailableMaterials(uniqueMaterials);
    } catch (error: any) {
      console.error('Error fetching workshop materials:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los materiales del taller",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkshopMaterials();
  }, [workshopId]);

  const addMaterial = () => {
    onMaterialsChange([
      ...selectedMaterials,
      { id: '', name: '', sku: '', color: null, unit: '', quantity: 0, available: 0 }
    ]);
  };

  const removeMaterial = (index: number) => {
    const updatedMaterials = selectedMaterials.filter((_, i) => i !== index);
    onMaterialsChange(updatedMaterials);
  };

  const updateMaterial = (index: number, field: keyof SelectedMaterial, value: any) => {
    const updatedMaterials = [...selectedMaterials];
    
    if (field === 'id' && value) {
      // Buscar el material seleccionado para obtener sus datos
      const material = availableMaterials.find(m => m.material_id === value);
      if (material) {
        updatedMaterials[index] = {
          ...updatedMaterials[index],
          id: material.material_id,
          name: material.material_name,
          sku: material.material_sku,
          color: material.material_color,
          unit: material.material_unit,
          available: material.real_balance,
          quantity: 0 // Reset quantity when material changes
        };
      }
    } else {
      updatedMaterials[index] = {
        ...updatedMaterials[index],
        [field]: value
      };
    }
    
    onMaterialsChange(updatedMaterials);
  };

  const getAvailableForSelection = (currentMaterialId?: string) => {
    // Filtrar materiales ya seleccionados, excepto el actual
    const selectedIds = selectedMaterials
      .map(m => m.id)
      .filter(id => id && id !== currentMaterialId);
    
    return availableMaterials.filter(material => 
      !selectedIds.includes(material.material_id)
    );
  };

  const formatMaterialDisplay = (material: WorkshopMaterial) => {
    const parts = [material.material_name];
    if (material.material_color) {
      parts.push(`- ${material.material_color}`);
    }
    parts.push(`(${material.material_sku})`);
    parts.push(`- ${material.real_balance} ${material.material_unit}`);
    return parts.join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-sm text-gray-500">Cargando materiales del taller...</div>
      </div>
    );
  }

  if (availableMaterials.length === 0) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">Sin materiales disponibles</h4>
        <p className="text-sm text-yellow-700">
          Este taller no tiene materiales en stock disponibles para consumir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <h4 className="font-medium text-orange-900 mb-2">Materiales disponibles en el taller</h4>
        <p className="text-sm text-orange-700">
          Solo se muestran los materiales que tienen stock disponible en este taller.
        </p>
      </div>

      {selectedMaterials.map((material, index) => (
        <div key={index} className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="lg:col-span-5 space-y-2">
            <Label>Material</Label>
            <SearchableMaterialSelector
              materials={getAvailableForSelection(material.id).map(mat => ({
                id: mat.material_id,
                name: mat.material_name,
                sku: mat.material_sku,
                color: mat.material_color,
                category: '', // No tenemos categoría en WorkshopMaterial
                unit: mat.material_unit,
                current_stock: mat.real_balance,
                supplier: ''
              }))}
              value={material.id || ''}
              onValueChange={(value) => updateMaterial(index, 'id', value)}
              placeholder="Buscar material..."
            />
          </div>

          <div className="lg:col-span-2 space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={material.available}
              value={material.quantity || ''}
              onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className={material.quantity > material.available ? 'border-red-500' : ''}
            />
            {material.quantity > material.available && material.available > 0 && (
              <p className="text-xs text-red-600">
                Cantidad máxima disponible: {material.available}
              </p>
            )}
          </div>

          <div className="lg:col-span-2 space-y-2">
            <Label>Unidad</Label>
            <Input
              value={material.unit || ''}
              readOnly
              className="bg-gray-100"
              placeholder="Selecciona material"
            />
          </div>

          <div className="lg:col-span-2 space-y-2">
            <Label>Disponible</Label>
            <div className="flex items-center h-10 px-3 rounded-md border bg-gray-100 text-sm">
              {material.available > 0 ? (
                <span className="text-green-600 font-medium">
                  {material.available} {material.unit}
                </span>
              ) : (
                <span className="text-gray-500">Selecciona material</span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 flex items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => removeMaterial(index)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addMaterial}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Material
      </Button>
    </div>
  );
};

export default WorkshopMaterialSelector;