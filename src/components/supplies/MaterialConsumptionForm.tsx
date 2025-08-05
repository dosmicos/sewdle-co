import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Package, Minus } from 'lucide-react';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';
import WorkshopMaterialSingleSelector from '@/components/WorkshopMaterialSingleSelector';

interface MaterialConsumptionFormProps {
  orderId: string;
  orderNumber: string;
  workshopId?: string;
  onClose: () => void;
  onConsumptionCompleted?: () => void;
}

interface ConsumptionItem {
  material_id: string;
  quantity: number;
  materialName?: string;
  unit?: string;
  availableStock?: number;
}

const MaterialConsumptionForm = ({ orderId, orderNumber, workshopId, onClose, onConsumptionCompleted }: MaterialConsumptionFormProps) => {
  const [consumptions, setConsumptions] = useState<ConsumptionItem[]>([
    { material_id: '', quantity: 0 }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { consumeOrderMaterials, loading: consumingLoading, getMaterialAvailability, validateMaterialConsumption } = useMaterialConsumption();

  const addConsumption = () => {
    setConsumptions([...consumptions, { material_id: '', quantity: 0 }]);
  };

  const removeConsumption = (index: number) => {
    if (consumptions.length > 1) {
      setConsumptions(consumptions.filter((_, i) => i !== index));
    }
  };

  const updateConsumption = async (index: number, field: string, value: any) => {
    const updated = [...consumptions];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se cambia el material, obtener información adicional
    if (field === 'material_id' && value && workshopId) {
      const availability = await getMaterialAvailability(value, workshopId);
      
      if (availability) {
        updated[index] = {
          ...updated[index],
          availableStock: availability.available
        };
      }
    }
    
    setConsumptions(updated);
    
    // Clear errors
    const errorKey = `material_${index}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    consumptions.forEach((consumption, index) => {
      if (!consumption.material_id) {
        newErrors[`material_${index}`] = 'Debe seleccionar un material';
      }
      if (consumption.quantity <= 0) {
        newErrors[`quantity_${index}`] = 'La cantidad debe ser mayor a 0';
      }
      if (consumption.availableStock !== undefined && consumption.quantity > consumption.availableStock) {
        newErrors[`quantity_${index}`] = `Stock insuficiente en este taller. Disponible: ${consumption.availableStock}`;
      }
    });

    const validConsumptions = consumptions.filter(c => c.material_id && c.quantity > 0);
    if (validConsumptions.length === 0) {
      newErrors.consumptions = 'Debe agregar al menos un consumo válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const validConsumptions = consumptions
      .filter(c => c.material_id && c.quantity > 0)
      .map(c => ({
        material_id: c.material_id,
        quantity: c.quantity
      }));

    const success = await consumeOrderMaterials(orderId, validConsumptions);
    
    if (success) {
      if (onConsumptionCompleted) {
        onConsumptionCompleted();
      }
      onClose();
    }
  };

  if (!workshopId) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-black">Error de Configuración</h3>
              <p className="text-gray-600">No se ha especificado el taller para el consumo de materiales.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            Consumir Materiales - {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Materiales a Consumir</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addConsumption}
                className="border-dashed"
              >
                <Package className="w-4 h-4 mr-2" />
                Agregar Material
              </Button>
            </div>

            {errors.consumptions && (
              <p className="text-red-500 text-sm mb-4">{errors.consumptions}</p>
            )}

            <div className="space-y-4">
              {consumptions.map((consumption, index) => {
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-black">Consumo #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeConsumption(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={consumptions.length === 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Material *
                        </label>
                        <WorkshopMaterialSingleSelector
                          workshopId={workshopId}
                          selectedMaterial={consumption.material_id}
                          onMaterialSelect={(materialId) => updateConsumption(index, 'material_id', materialId)}
                          placeholder="Seleccionar material del taller..."
                        />
                        {errors[`material_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`material_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Cantidad a Consumir *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={consumption.quantity || ''}
                          onChange={async (e) => {
                            const newQuantity = parseFloat(e.target.value) || 0;
                            await updateConsumption(index, 'quantity', newQuantity);
                            
                            // Real-time validation
                            if (consumption.material_id && workshopId && newQuantity > 0) {
                              const validation = await validateMaterialConsumption(
                                consumption.material_id, 
                                workshopId, 
                                newQuantity
                              );
                              if (!validation.isValid) {
                                setErrors(prev => ({ 
                                  ...prev, 
                                  [`quantity_${index}`]: validation.error || 'Stock insuficiente'
                                }));
                              } else {
                                setErrors(prev => {
                                  const newErrors = { ...prev };
                                  delete newErrors[`quantity_${index}`];
                                  return newErrors;
                                });
                              }
                            }
                          }}
                          placeholder="0"
                          className={errors[`quantity_${index}`] ? 'border-red-500' : ''}
                        />
                        {errors[`quantity_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`quantity_${index}`]}</p>
                        )}
                      </div>
                    </div>

                    {consumption.availableStock !== undefined && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <div className={`flex items-center ${
                          consumption.availableStock <= 10 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {consumption.availableStock <= 10 && (
                            <AlertTriangle className="w-4 h-4 mr-1" />
                          )}
                          <span className="font-medium">
                            Stock disponible en taller: {consumption.availableStock}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={consumingLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={consumingLoading}
            >
              {consumingLoading ? 'Consumiendo...' : 'Consumir Materiales'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialConsumptionForm;