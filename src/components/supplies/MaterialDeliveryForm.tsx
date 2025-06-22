import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Trash2, Plus } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import { useOrders } from '@/hooks/useOrders';

interface MaterialDeliveryFormProps {
  onClose: () => void;
  onDeliveryCreated?: () => void;
  prefilledData?: {
    orderId?: string;
    workshopId?: string;
    materials?: {
      materialId: string;
      quantity: number;
      unit: string;
      notes?: string;
    }[];
  };
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

const MaterialDeliveryForm = ({ onClose, onDeliveryCreated, prefilledData }: MaterialDeliveryFormProps) => {
  const [formData, setFormData] = useState({
    orderId: prefilledData?.orderId || '',
    workshopId: prefilledData?.workshopId || '',
    deliveredBy: '',
    notes: ''
  });
  const [materials, setMaterials] = useState(
    prefilledData?.materials || [{ materialId: '', quantity: 0, unit: '', notes: '' }]
  );
  const [supportDocument, setSupportDocument] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const { materials: availableMaterials, loading: materialsLoading } = useMaterials();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { fetchOrders } = useOrders();
  const { createMaterialDelivery, loading: deliveryLoading } = useMaterialDeliveries();

  const loadOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      setOrdersError(null);
      console.log('Loading orders for material delivery form...');
      const ordersData = await fetchOrders();
      console.log('Orders loaded successfully:', ordersData?.length || 0);
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrdersError('Error al cargar las órdenes. El formulario funcionará sin órdenes.');
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [fetchOrders]);

  useEffect(() => {
    if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        orderId: prefilledData.orderId || prev.orderId,
        workshopId: prefilledData.workshopId || prev.workshopId
      }));
      
      if (prefilledData.materials && prefilledData.materials.length > 0) {
        setMaterials(prefilledData.materials);
      }
    }
  }, [prefilledData]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleMaterialChange = (index: number, field: string, value: string | number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se cambia el material, actualizar la unidad automáticamente
    if (field === 'materialId') {
      const selectedMaterial = availableMaterials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    setMaterials(updated);
    
    // Clear material errors
    const errorKey = `material_${index}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { materialId: '', quantity: 0, unit: '', notes: '' }]);
  };

  const removeMaterial = (index: number) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSupportDocument(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validar taller (requerido)
    if (!formData.workshopId) {
      newErrors.workshopId = 'El taller destino es requerido';
    }

    // Validar persona que entrega (requerido)
    if (!formData.deliveredBy.trim()) {
      newErrors.deliveredBy = 'El nombre de quien entrega es requerido';
    }

    // Validar materiales
    materials.forEach((material, index) => {
      if (!material.materialId) {
        newErrors[`material_${index}`] = 'Debe seleccionar un material';
      }
      if (material.quantity <= 0) {
        newErrors[`quantity_${index}`] = 'La cantidad debe ser mayor a 0';
      }
    });

    // Validar que tenga al menos un material válido
    const validMaterials = materials.filter(m => m.materialId && m.quantity > 0);
    if (validMaterials.length === 0) {
      newErrors.materials = 'Debe agregar al menos un material válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const deliveryData = {
        workshopId: formData.workshopId,
        orderId: formData.orderId === 'none' || !formData.orderId ? undefined : formData.orderId,
        deliveredBy: formData.deliveredBy,
        notes: formData.notes,
        materials: materials.filter(m => m.materialId && m.quantity > 0),
        supportDocument: supportDocument || undefined
      };

      console.log('Submitting material delivery:', deliveryData);
      await createMaterialDelivery(deliveryData);
      
      if (onDeliveryCreated) {
        onDeliveryCreated();
      }
      onClose();
    } catch (error) {
      console.error('Error creating material delivery:', error);
    }
  };

  // Show loading only if critical resources are loading
  if (materialsLoading || workshopsLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Upload className="w-8 h-8 text-gray-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-black">Cargando datos...</h3>
              <p className="text-gray-600">Obteniendo catálogo de materiales y talleres</p>
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
            Nueva Entrega de Materiales
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Orden de Producción (Opcional)
              </label>
              <Select
                value={formData.orderId}
                onValueChange={(value) => handleInputChange('orderId', value)}
              >
                <SelectTrigger className={errors.orderId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Sin orden asignada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin orden asignada</SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingOrders && (
                <p className="text-xs text-blue-500 mt-1">Cargando órdenes...</p>
              )}
              {ordersError && (
                <p className="text-xs text-orange-500 mt-1">{ordersError}</p>
              )}
              {!loadingOrders && !ordersError && (
                <p className="text-xs text-gray-500 mt-1">
                  {orders.length === 0 
                    ? 'No hay órdenes disponibles - puedes registrar entregas sin orden asignada'
                    : 'Deja vacío si los materiales son para órdenes futuras'
                  }
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Taller Destino *
              </label>
              <Select
                value={formData.workshopId}
                onValueChange={(value) => handleInputChange('workshopId', value)}
              >
                <SelectTrigger className={errors.workshopId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Seleccionar taller..." />
                </SelectTrigger>
                <SelectContent>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workshopId && (
                <p className="text-red-500 text-xs mt-1">{errors.workshopId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Entregado por *
              </label>
              <Input
                value={formData.deliveredBy}
                onChange={(e) => handleInputChange('deliveredBy', e.target.value)}
                placeholder="Nombre de quien entrega"
                className={errors.deliveredBy ? 'border-red-500' : ''}
                required
              />
              {errors.deliveredBy && (
                <p className="text-red-500 text-xs mt-1">{errors.deliveredBy}</p>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Materiales a Entregar</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addMaterial}
                className="border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Material
              </Button>
            </div>

            {errors.materials && (
              <p className="text-red-500 text-sm mb-4">{errors.materials}</p>
            )}

            <div className="space-y-4">
              {materials.map((material, index) => {
                const selectedMaterial = availableMaterials.find(m => m.id === material.materialId);
                
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-black">Material #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMaterial(index)}
                        className="text-red-500 hover:text-red-700"
                        disabled={materials.length === 1}
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
                          value={material.materialId}
                          onValueChange={(value) => handleMaterialChange(index, 'materialId', value)}
                        >
                          <SelectTrigger className={errors[`material_${index}`] ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Seleccionar material..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMaterials.map((mat) => (
                              <SelectItem key={mat.id} value={mat.id}>
                                <div className="flex items-center">
                                  {getColorIndicator(mat.color)}
                                  <span>{formatMaterialDisplay(mat)}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors[`material_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`material_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Cantidad *
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={material.quantity || ''}
                          onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className={errors[`quantity_${index}`] ? 'border-red-500' : ''}
                        />
                        {errors[`quantity_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`quantity_${index}`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-black mb-2">
                          Unidad
                        </label>
                        <Input
                          value={material.unit}
                          readOnly
                          className="bg-gray-50"
                          placeholder="Selecciona un material"
                        />
                      </div>
                    </div>

                    {selectedMaterial && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-black mb-2">
                          Información del Material
                        </label>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center mb-2">
                            {getColorIndicator(selectedMaterial.color)}
                            <div className="font-medium text-black">{selectedMaterial.name}</div>
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
                          <div className="text-sm text-gray-600">
                            Stock actual: {selectedMaterial.current_stock} {selectedMaterial.unit}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-black mb-2">
                        Notas del Material
                      </label>
                      <Input
                        value={material.notes || ''}
                        onChange={(e) => handleMaterialChange(index, 'notes', e.target.value)}
                        placeholder="Especificaciones adicionales para este material..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Documento de Soporte (Opcional)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="support-document"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="support-document"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Haz clic para subir guía de entrega
                </span>
                <span className="text-xs text-gray-500">
                  PDF, JPG, PNG (máx 10MB)
                </span>
              </label>
              
              {supportDocument && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm text-black">{supportDocument.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSupportDocument(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Notas Generales
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Comentarios adicionales sobre la entrega..."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={deliveryLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={deliveryLoading}
            >
              {deliveryLoading ? 'Registrando...' : 'Registrar Entrega'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDeliveryForm;
