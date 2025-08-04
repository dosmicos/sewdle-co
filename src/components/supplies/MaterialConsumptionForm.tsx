
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, Package, Minus, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMaterials } from '@/hooks/useMaterials';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';

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
  const [openSelectors, setOpenSelectors] = useState<Record<number, boolean>>({});

  const { materials, loading: materialsLoading } = useMaterials();
  const { consumeOrderMaterials, loading: consumingLoading, getMaterialAvailability } = useMaterialConsumption();

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
    if (field === 'material_id' && value) {
      const selectedMaterial = materials.find(m => m.id === value);
      const availability = await getMaterialAvailability(value, workshopId);
      
      if (selectedMaterial && availability) {
        updated[index] = {
          ...updated[index],
          materialName: selectedMaterial.name,
          unit: selectedMaterial.unit,
          availableStock: availability.available
        };
      }
    }
    
    setConsumptions(updated);
    
    // Clear errors
    const errorKey = `consumption_${index}`;
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
        newErrors[`quantity_${index}`] = `Stock insuficiente en este taller. Disponible: ${consumption.availableStock} ${consumption.unit || ''}`;
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

  if (materialsLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2 text-black">Cargando materiales...</h3>
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
                const selectedMaterial = materials.find(m => m.id === consumption.material_id);
                
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Material *
                        </label>
                        <Popover 
                          open={openSelectors[index] || false} 
                          onOpenChange={(open) => setOpenSelectors(prev => ({ ...prev, [index]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openSelectors[index] || false}
                              className={cn(
                                "w-full justify-between",
                                errors[`material_${index}`] ? 'border-red-500' : '',
                                !consumption.material_id && "text-muted-foreground"
                              )}
                            >
                              {consumption.material_id
                                ? (() => {
                                    const material = materials.find((m) => m.id === consumption.material_id);
                                    return material ? `${material.sku} - ${material.name}` : "Seleccionar material...";
                                  })()
                                : "Seleccionar material..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0 z-50 bg-white border border-gray-200 shadow-lg">
                            <Command>
                              <CommandInput placeholder="Buscar material..." className="h-9" />
                              <CommandList>
                                <CommandEmpty>No se encontraron materiales.</CommandEmpty>
                                <CommandGroup>
                                  {materials.map((material) => (
                                    <CommandItem
                                      key={material.id}
                                      value={`${material.sku} ${material.name} ${material.color || ''}`}
                                      onSelect={() => {
                                        updateConsumption(index, 'material_id', material.id);
                                        setOpenSelectors(prev => ({ ...prev, [index]: false }));
                                      }}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center">
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              consumption.material_id === material.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div>
                                            <div className="font-medium">{material.sku} - {material.name}</div>
                                            {material.color && (
                                              <div className="text-xs text-gray-500">{material.color}</div>
                                            )}
                                          </div>
                                        </div>
                                        <span className="text-xs text-gray-500 ml-2">
                                          Stock: {material.current_stock} {material.unit}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
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
                          onChange={(e) => updateConsumption(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className={errors[`quantity_${index}`] ? 'border-red-500' : ''}
                        />
                        {errors[`quantity_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`quantity_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Stock en Taller
                        </label>
                        <div className="p-2 bg-gray-50 rounded border text-sm">
                          {consumption.unit && (
                            <div>Unidad: {consumption.unit}</div>
                          )}
                          {consumption.availableStock !== undefined ? (
                            <div className={`flex items-center ${
                              consumption.availableStock <= (selectedMaterial?.min_stock_alert || 0) 
                                ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {consumption.availableStock <= (selectedMaterial?.min_stock_alert || 0) && (
                                <AlertTriangle className="w-4 h-4 mr-1" />
                              )}
                              Disponible en taller: {consumption.availableStock} {consumption.unit}
                            </div>
                          ) : (
                            <div className="text-gray-500 text-xs">
                              {workshopId ? 'Sin stock en este taller' : 'Selecciona un material'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedMaterial && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <h5 className="font-medium text-black mb-2">Información del Material</h5>
                        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>SKU: {selectedMaterial.sku}</div>
                          <div>Categoría: {selectedMaterial.category}</div>
                          {selectedMaterial.color && <div>Color: {selectedMaterial.color}</div>}
                          {selectedMaterial.supplier && <div>Proveedor: {selectedMaterial.supplier}</div>}
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
