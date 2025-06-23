
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Truck, CheckCircle, XCircle } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';

interface MaterialRequirement {
  materialId: string;
  quantity: number;
  unit: string;
}

interface OrderMaterialAlertProps {
  sufficientMaterials: MaterialRequirement[];
  insufficientMaterials: MaterialRequirement[];
  workshopStock: Record<string, number>;
  onCreateDelivery?: () => void;
  onProceedAnyway?: () => void;
}

const OrderMaterialAlert = ({
  sufficientMaterials,
  insufficientMaterials,
  workshopStock,
  onCreateDelivery,
  onProceedAnyway
}: OrderMaterialAlertProps) => {
  const { materials } = useMaterials();

  const getMaterialName = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material ? `${material.name} (${material.sku})` : 'Material desconocido';
  };

  const getMaterialUnit = (materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    return material?.unit || 'unidad';
  };

  const handleCreateDelivery = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('OrderMaterialAlert: handleCreateDelivery clicked');
    
    if (onCreateDelivery) {
      console.log('OrderMaterialAlert: Calling onCreateDelivery');
      onCreateDelivery();
    }
  };

  const handleProceedAnyway = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('OrderMaterialAlert: handleProceedAnyway clicked');
    
    if (onProceedAnyway) {
      console.log('OrderMaterialAlert: Calling onProceedAnyway');
      onProceedAnyway();
    }
  };

  if (insufficientMaterials.length === 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <div className="flex items-center justify-between">
            <div>
              <strong>Todos los materiales están disponibles en el taller</strong>
              <p className="text-sm mt-1">Se consumirán automáticamente al crear la orden.</p>
            </div>
            <Badge variant="outline" className="border-green-500 text-green-700">
              ✓ Stock suficiente
            </Badge>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Alerta de materiales insuficientes */}
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <strong>Materiales insuficientes en el taller</strong>
                <p className="text-sm mt-1">
                  Algunos materiales no están disponibles en cantidad suficiente
                </p>
              </div>
              <div className="flex space-x-2">
                {onCreateDelivery && (
                  <Button
                    type="button"
                    onClick={handleCreateDelivery}
                    size="sm"
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <Truck className="w-4 h-4 mr-1" />
                    Crear Entrega
                  </Button>
                )}
                {onProceedAnyway && (
                  <Button
                    type="button"
                    onClick={handleProceedAnyway}
                    size="sm"
                    variant="outline"
                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-50"
                  >
                    Crear Orden de Todas Formas
                  </Button>
                )}
              </div>
            </div>

            {/* Lista de materiales faltantes */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-yellow-900">
                Materiales faltantes:
              </div>
              {insufficientMaterials.map((material, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm text-gray-900">
                      {getMaterialName(material.materialId)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="border-red-500 text-red-700">
                      Faltan: {material.quantity} {getMaterialUnit(material.materialId)}
                    </Badge>
                    <Badge variant="outline" className="border-gray-400 text-gray-600">
                      Disponible: {workshopStock[material.materialId] || 0} {getMaterialUnit(material.materialId)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Materiales suficientes (si los hay) */}
      {sufficientMaterials.length > 0 && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <div className="space-y-2">
              <div className="text-sm font-medium text-green-900">
                Materiales disponibles ({sufficientMaterials.length}):
              </div>
              {sufficientMaterials.map((material, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-900">
                      {getMaterialName(material.materialId)}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    ✓ {material.quantity} {getMaterialUnit(material.materialId)} OK
                  </Badge>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default OrderMaterialAlert;
