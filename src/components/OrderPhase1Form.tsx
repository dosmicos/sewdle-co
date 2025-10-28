import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';

interface OrderPhase1FormProps {
  orderId: string;
  workshopId?: string;
  onPhaseComplete: (formData: Phase1FormData) => void;
}

type ProductType = string;

// Phase 1 Form Data Structure
interface Phase1FormData {
  // Product Specification
  mainProduct: ProductType | '';
  designModel: string;
  
  // Base Materials (Always Visible)
  fabricMeters: number;
  zipperQuantity: number;
  cordMeters: number;
  
  // Special Materials (Conditional)
  toeCapQuantity?: number; // Ruana
  waddingMeters?: number; // Ruana
  embroideryCloth?: boolean; // Ruana
  bias?: boolean; // Chaqueta
  broochQuantity?: number; // Chaqueta
  rivet?: boolean; // Sleeping
}

const OrderPhase1Form: React.FC<OrderPhase1FormProps> = ({ 
  orderId, 
  workshopId,
  onPhaseComplete 
}) => {
  const { toast } = useToast();
  const { products, loading: productsLoading } = useProducts();
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState<Phase1FormData>({
    mainProduct: '',
    designModel: '',
    fabricMeters: 0,
    zipperQuantity: 0,
    cordMeters: 0,
    toeCapQuantity: 0,
    waddingMeters: 0,
    embroideryCloth: false,
    bias: false,
    broochQuantity: 0,
    rivet: false,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form field
  const updateField = <K extends keyof Phase1FormData>(
    field: K,
    value: Phase1FormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user updates field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };
  
  // Check if special fields should be visible
  const shouldShowRuanaFields = formData.mainProduct === 'Ruana';
  const shouldShowChaquetaFields = formData.mainProduct === 'Chaqueta';
  const shouldShowSleepingFields = formData.mainProduct === 'Sleeping';

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate product specification
    if (!formData.mainProduct) {
      newErrors.mainProduct = 'Debe seleccionar un producto principal';
    }

    if (!formData.designModel.trim()) {
      newErrors.designModel = 'Debe especificar el diseño/modelo';
    }

    // Validate base materials (always required)
    if (formData.fabricMeters <= 0) {
      newErrors.fabricMeters = 'Debe ingresar el metraje de tela';
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

    setLoading(true);
    
    try {
      // Call parent handler with form data
      await onPhaseComplete(formData);
      
      toast({
        title: 'Fase 1 completada',
        description: 'Los datos de optimización e insumos han sido registrados correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo completar la Fase 1',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              📋 Fase 1: Recepción de OP, Optimización y Registro de Insumos
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Esta fase marca el inicio formal de la producción. Complete la especificación del producto y registre con precisión las cantidades de insumos que serán despachados al taller de Corte y Confección.
            </p>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p><strong>⏱️ Tiempo de Optimización:</strong> El tiempo hasta completar esta fase será registrado como métrica clave para medir la eficiencia de la planificación.</p>
            </div>
          </div>

          {/* Product Specification */}
          <div className="space-y-4 border-b border-border pb-6">
            <h3 className="text-lg font-semibold">Especificación de Producto</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="mainProduct">Producto Principal *</Label>
                <Select
                  value={formData.mainProduct}
                  onValueChange={(value) => updateField('mainProduct', value as ProductType)}
                >
                  <SelectTrigger id="mainProduct" className={errors.mainProduct ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productsLoading ? (
                      <SelectItem value="loading" disabled>Cargando productos...</SelectItem>
                    ) : products.length === 0 ? (
                      <SelectItem value="empty" disabled>No hay productos disponibles</SelectItem>
                    ) : (
                      products.map(product => (
                        <SelectItem key={product.id} value={product.name}>
                          {product.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.mainProduct && (
                  <p className="text-destructive text-xs mt-1">{errors.mainProduct}</p>
                )}
              </div>

              <div>
                <Label htmlFor="designModel">Diseño/Modelo *</Label>
                <Input
                  id="designModel"
                  value={formData.designModel}
                  onChange={(e) => updateField('designModel', e.target.value)}
                  placeholder="Ej: Ruana Diseño Selva"
                  className={errors.designModel ? 'border-destructive' : ''}
                />
                {errors.designModel && (
                  <p className="text-destructive text-xs mt-1">{errors.designModel}</p>
                )}
              </div>
            </div>
          </div>

          {/* Base Materials (Always Visible) */}
          <div className="space-y-4 border-b border-border pb-6">
            <h3 className="text-lg font-semibold">Insumos Base</h3>
            <p className="text-sm text-muted-foreground">Estos campos son requeridos para todos los productos</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="fabricMeters">Metraje de Tela (m) *</Label>
                <Input
                  id="fabricMeters"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.fabricMeters || ''}
                  onChange={(e) => updateField('fabricMeters', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={errors.fabricMeters ? 'border-destructive' : ''}
                />
                {errors.fabricMeters && (
                  <p className="text-destructive text-xs mt-1">{errors.fabricMeters}</p>
                )}
              </div>

              <div>
                <Label htmlFor="zipperQuantity">Cantidad de Cremalleras</Label>
                <Input
                  id="zipperQuantity"
                  type="number"
                  min="0"
                  value={formData.zipperQuantity || ''}
                  onChange={(e) => updateField('zipperQuantity', parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="cordMeters">Metraje de Cordones (m)</Label>
                <Input
                  id="cordMeters"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cordMeters || ''}
                  onChange={(e) => updateField('cordMeters', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Conditional Materials - Ruana */}
          {shouldShowRuanaFields && (
            <div className="space-y-4 border-b border-border pb-6">
              <h3 className="text-lg font-semibold">Insumos Especiales - Ruana</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="toeCapQuantity">Cantidad de Punteras</Label>
                  <Input
                    id="toeCapQuantity"
                    type="number"
                    min="0"
                    value={formData.toeCapQuantity || ''}
                    onChange={(e) => updateField('toeCapQuantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="waddingMeters">Metraje de Guata (m)</Label>
                  <Input
                    id="waddingMeters"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.waddingMeters || ''}
                    onChange={(e) => updateField('waddingMeters', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-8">
                  <Checkbox
                    id="embroideryCloth"
                    checked={formData.embroideryCloth}
                    onCheckedChange={(checked) => updateField('embroideryCloth', checked as boolean)}
                  />
                  <Label htmlFor="embroideryCloth" className="cursor-pointer">
                    Pañolense para Bordados
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Conditional Materials - Chaqueta */}
          {shouldShowChaquetaFields && (
            <div className="space-y-4 border-b border-border pb-6">
              <h3 className="text-lg font-semibold">Insumos Especiales - Chaqueta</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bias"
                    checked={formData.bias}
                    onCheckedChange={(checked) => updateField('bias', checked as boolean)}
                  />
                  <Label htmlFor="bias" className="cursor-pointer">
                    Sesgo
                  </Label>
                </div>

                <div>
                  <Label htmlFor="broochQuantity">Cantidad de Broches</Label>
                  <Input
                    id="broochQuantity"
                    type="number"
                    min="0"
                    value={formData.broochQuantity || ''}
                    onChange={(e) => updateField('broochQuantity', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Materials - Sleeping */}
          {shouldShowSleepingFields && (
            <div className="space-y-4 border-b border-border pb-6">
              <h3 className="text-lg font-semibold">Insumos Especiales - Sleeping</h3>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="rivet"
                  checked={formData.rivet}
                  onCheckedChange={(checked) => updateField('rivet', checked as boolean)}
                />
                <Label htmlFor="rivet" className="cursor-pointer">
                  Riv
                </Label>
              </div>
            </div>
          )}

          {/* Complete Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button
              onClick={handleCompletePhase}
              disabled={loading || !formData.mainProduct}
              size="lg"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {loading ? 'Completando Fase 1...' : 'Completar Fase 1'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderPhase1Form;
