
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, Truck } from 'lucide-react';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { useUserContext } from '@/hooks/useUserContext';
import SearchableMaterialSelector from './SearchableMaterialSelector';

interface MaterialDeliveryItem {
  materialId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface PrefilledData {
  workshopId?: string;
  materials?: MaterialDeliveryItem[];
}

interface MaterialDeliveryFormProps {
  onClose: () => void;
  onDeliveryCreated?: () => void;
  prefilledData?: PrefilledData;
}

const MaterialDeliveryForm = ({ onClose, onDeliveryCreated, prefilledData }: MaterialDeliveryFormProps) => {
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [selectedWorkshop, setSelectedWorkshop] = useState(
    isWorkshopUser ? workshopFilter || '' : prefilledData?.workshopId || ''
  );
  const [deliveryItems, setDeliveryItems] = useState<MaterialDeliveryItem[]>(
    prefilledData?.materials || [{ materialId: '', quantity: 0, unit: '', notes: '' }]
  );
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { materials, loading: materialsLoading } = useMaterials();
  const { createMaterialDelivery, loading: creatingDelivery } = useMaterialDeliveries();

  // Helper function to format material display name with color
  const formatMaterialDisplayName = (material: unknown) => {
    const baseName = `${material.name} (${material.sku})`;
    return material.color ? `${baseName} - ${material.color}` : baseName;
  };

  const addDeliveryItem = () => {
    setDeliveryItems([...deliveryItems, { materialId: '', quantity: 0, unit: '', notes: '' }]);
  };

  const removeDeliveryItem = (index: number) => {
    if (deliveryItems.length > 1) {
      setDeliveryItems(deliveryItems.filter((_, i) => i !== index));
    }
  };

  const updateDeliveryItem = (index: number, field: keyof MaterialDeliveryItem, value: string | number) => {
    const updated = [...deliveryItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-update unit when material is selected
    if (field === 'materialId') {
      const selectedMaterial = materials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    setDeliveryItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkshop) {
      alert('Por favor selecciona un taller');
      return;
    }

    const validItems = deliveryItems.filter(item => 
      item.materialId && item.quantity > 0
    );

    if (validItems.length === 0) {
      alert('Debe agregar al menos un material válido');
      return;
    }

    try {
      const deliveryData = {
        workshopId: selectedWorkshop,
        materials: validItems.map(item => ({
          materialId: item.materialId,
          quantity: Number(item.quantity),
          unit: item.unit,
          notes: item.notes || undefined
        })),
        deliveredBy: selectedWorkshop, // Using workshop as deliveredBy for now
        notes: deliveryNotes.trim() || undefined
      };

      await createMaterialDelivery(deliveryData);
      
      if (onDeliveryCreated) {
        onDeliveryCreated();
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating material delivery:', error);
    }
  };

  if (materialsLoading || workshopsLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <Package className="w-8 h-8 text-gray-400 animate-pulse mr-2" />
            <span className="text-gray-600">Cargando datos...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black flex items-center">
            <Truck className="w-6 h-6 mr-2" />
            Crear Entrega de Materiales
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selección de Taller */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Taller Destino</h3>
            <Select 
              value={selectedWorkshop} 
              onValueChange={setSelectedWorkshop}
              disabled={isWorkshopUser} // Deshabilitar para usuarios de taller
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={isWorkshopUser ? "Tu taller" : "Seleccionar taller..."} />
              </SelectTrigger>
              <SelectContent>
                {workshops
                  .filter(workshop => !isWorkshopUser || workshop.id === workshopFilter)
                  .map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Card>

          {/* Materiales a Entregar */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Materiales a Entregar</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addDeliveryItem}
                className="border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Material
              </Button>
            </div>

            <div className="space-y-4">
              {deliveryItems.map((item, index) => {
                const selectedMaterial = materials.find(m => m.id === item.materialId);
                
                return (
                  <Card key={index} className="p-4 border-2">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-black">Material #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDeliveryItem(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={deliveryItems.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-black mb-2">
                          Material *
                        </Label>
                        <SearchableMaterialSelector
                          materials={materials}
                          value={item.materialId}
                          onValueChange={(value) => updateDeliveryItem(index, 'materialId', value)}
                          placeholder="Buscar material..."
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-black mb-2">
                          Cantidad *
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => updateDeliveryItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-black mb-2">
                          Unidad
                        </Label>
                        <Input
                          value={item.unit}
                          readOnly
                          className="bg-gray-50"
                          placeholder="Selecciona un material"
                        />
                      </div>
                    </div>

                    {/* Información del material seleccionado */}
                    {selectedMaterial && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-700">
                          <div><strong>Categoría:</strong> {selectedMaterial.category}</div>
                          {selectedMaterial.color && (
                            <div className="flex items-center">
                              <strong>Color:</strong> 
                              <Badge variant="outline" className="ml-2 font-medium text-blue-700 border-blue-200">
                                {selectedMaterial.color}
                              </Badge>
                            </div>
                          )}
                          {selectedMaterial.supplier && (
                            <div><strong>Proveedor:</strong> {selectedMaterial.supplier}</div>
                          )}
                          <div><strong>Stock Global:</strong> {selectedMaterial.current_stock} {selectedMaterial.unit}</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <Label className="text-sm font-medium text-black mb-2">
                        Notas del Material
                      </Label>
                      <Input
                        value={item.notes || ''}
                        onChange={(e) => updateDeliveryItem(index, 'notes', e.target.value)}
                        placeholder="Especificaciones adicionales..."
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          </Card>

          {/* Notas Generales */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Notas de la Entrega</h3>
            <Textarea
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Comentarios adicionales sobre la entrega..."
              className="min-h-[100px]"
            />
          </Card>

          {/* Botones de Acción */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={creatingDelivery}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={creatingDelivery}
            >
              {creatingDelivery ? 'Creando Entrega...' : 'Crear Entrega'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDeliveryForm;
