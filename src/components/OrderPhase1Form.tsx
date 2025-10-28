import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Minus, CheckCircle2 } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';
import SearchableProductSelector from '@/components/SearchableProductSelector';
import WorkshopMaterialSingleSelector from '@/components/WorkshopMaterialSingleSelector';
import { useToast } from '@/hooks/use-toast';

// Extend Product type to match SearchableProductSelector expectations
type ProductWithVariants = ReturnType<typeof useProducts>['products'][0] & { variants?: any[] };

interface OrderPhase1FormProps {
  orderId: string;
  workshopId?: string;
  onPhaseComplete: () => void;
}

interface MaterialItem {
  material_id: string;
  quantity: number;
}

const OrderPhase1Form: React.FC<OrderPhase1FormProps> = ({ 
  orderId, 
  workshopId,
  onPhaseComplete 
}) => {
  const { products } = useProducts();
  const { consumeOrderMaterials, loading } = useMaterialConsumption();
  const { toast } = useToast();
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [materials, setMaterials] = useState<MaterialItem[]>([
    { material_id: '', quantity: 0 }
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addMaterial = () => {
    setMaterials([...materials, { material_id: '', quantity: 0 }]);
  };

  const removeMaterial = (index: number) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((_, i) => i !== index));
    }
  };

  const updateMaterial = (index: number, field: keyof MaterialItem, value: any) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    setMaterials(updated);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedProductId) {
      newErrors.product = 'Debe seleccionar un producto';
    }

    materials.forEach((material, index) => {
      if (!material.material_id) {
        newErrors[`material_${index}`] = 'Debe seleccionar un material';
      }
      if (material.quantity <= 0) {
        newErrors[`quantity_${index}`] = 'La cantidad debe ser mayor a 0';
      }
    });

    const validMaterials = materials.filter(m => m.material_id && m.quantity > 0);
    if (validMaterials.length === 0) {
      newErrors.materials = 'Debe agregar al menos un material';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCompletePhase = async () => {
    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor complete todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    if (!workshopId) {
      toast({
        title: 'Error',
        description: 'No se ha asignado un taller a esta orden',
        variant: 'destructive',
      });
      return;
    }

    const validMaterials = materials
      .filter(m => m.material_id && m.quantity > 0)
      .map(m => ({
        material_id: m.material_id,
        quantity: m.quantity
      }));

    const success = await consumeOrderMaterials(orderId, validMaterials);
    
    if (success) {
      onPhaseComplete();
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header con instrucciones */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">
              📋 Fase 1: Recepción de OP, Optimización y Registro de Insumos
            </h4>
            <p className="text-sm text-blue-800 mb-3">
              Esta fase marca el inicio formal de la producción. Por favor, complete la especificación del producto y registre con precisión las cantidades de insumos que serán despachados al taller de Corte y Confección.
            </p>
            <div className="text-sm text-blue-700 space-y-1">
              <p><strong>⏱️ Tiempo de Optimización:</strong> El tiempo que transcurra hasta completar esta fase será registrado como una métrica clave para medir la eficiencia de nuestra planificación.</p>
            </div>
          </div>

          {/* Selección de Producto */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Selección de Producto *
            </label>
            <SearchableProductSelector
              products={products.map(p => ({ ...p, variants: [] })) as any}
              selectedProductId={selectedProductId}
              onProductSelect={setSelectedProductId}
              placeholder="Seleccionar producto principal..."
            />
            {errors.product && (
              <p className="text-destructive text-xs mt-1">{errors.product}</p>
            )}
          </div>

          {/* Registro de Materiales */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-foreground">
                Registro de Materiales *
              </label>
            </div>

            {errors.materials && (
              <p className="text-destructive text-sm mb-3">{errors.materials}</p>
            )}

            <div className="space-y-3">
              {materials.map((material, index) => (
                <div key={index} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm text-foreground">Insumo #{index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      disabled={materials.length === 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Material
                      </label>
                      {workshopId ? (
                        <WorkshopMaterialSingleSelector
                          workshopId={workshopId}
                          selectedMaterial={material.material_id}
                          onMaterialSelect={(materialId) => updateMaterial(index, 'material_id', materialId)}
                          placeholder="Seleccionar material..."
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Asigne un taller primero</p>
                      )}
                      {errors[`material_${index}`] && (
                        <p className="text-destructive text-xs mt-1">{errors[`material_${index}`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Cantidad a Despachar
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={material.quantity || ''}
                        onChange={(e) => updateMaterial(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                      {errors[`quantity_${index}`] && (
                        <p className="text-destructive text-xs mt-1">{errors[`quantity_${index}`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={addMaterial}
                className="border-dashed"
              >
                <Package className="w-4 h-4 mr-2" />
                Agregar Material
              </Button>
            </div>
          </div>

          {/* Botón Completar Fase 1 */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleCompletePhase}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {loading ? 'Completando...' : 'Completar Fase 1'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderPhase1Form;
