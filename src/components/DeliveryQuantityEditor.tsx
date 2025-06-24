
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Edit, Save, X, AlertTriangle } from 'lucide-react';

interface DeliveryQuantityEditorProps {
  deliveryData: any;
  onSave: (quantityUpdates: Array<{id: string, quantity: number}>) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

const DeliveryQuantityEditor: React.FC<DeliveryQuantityEditorProps> = ({
  deliveryData,
  onSave,
  onCancel,
  loading = false
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Inicializar cantidades actuales
  useEffect(() => {
    if (deliveryData?.delivery_items) {
      const initialQuantities: Record<string, number> = {};
      deliveryData.delivery_items.forEach((item: any) => {
        initialQuantities[item.id] = item.quantity_delivered || 0;
      });
      setQuantities(initialQuantities);
    }
  }, [deliveryData]);

  // Helper function para obtener info del producto
  const getProductInfo = (item: any) => {
    const product = item?.order_items?.product_variants?.products;
    const variant = item?.order_items?.product_variants;
    
    return {
      productName: product?.name || 'Producto sin nombre',
      variantSize: variant?.size || 'N/A',
      variantColor: variant?.color || 'N/A',
      skuVariant: variant?.sku_variant || `SKU-${item?.id || 'unknown'}`,
      maxQuantity: item?.order_items?.quantity || 0
    };
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    const item = deliveryData.delivery_items.find((i: any) => i.id === itemId);
    const maxQuantity = item?.order_items?.quantity || 0;

    // Validar cantidad
    if (numValue < 0) {
      setErrors(prev => ({ ...prev, [itemId]: 'La cantidad no puede ser negativa' }));
    } else if (numValue > maxQuantity) {
      setErrors(prev => ({ ...prev, [itemId]: `La cantidad no puede exceder ${maxQuantity} (cantidad ordenada)` }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }

    setQuantities(prev => ({ ...prev, [itemId]: numValue }));
  };

  const handleSave = async () => {
    // Verificar que no hay errores
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Preparar updates solo para items que cambiaron
    const updates: Array<{id: string, quantity: number}> = [];
    
    deliveryData.delivery_items.forEach((item: any) => {
      const currentQuantity = item.quantity_delivered || 0;
      const newQuantity = quantities[item.id] || 0;
      
      if (newQuantity !== currentQuantity) {
        updates.push({
          id: item.id,
          quantity: newQuantity
        });
      }
    });

    if (updates.length === 0) {
      onCancel(); // No hay cambios
      return;
    }

    const success = await onSave(updates);
    if (success) {
      onCancel(); // Cerrar editor después de guardar
    }
  };

  const hasChanges = () => {
    return deliveryData.delivery_items.some((item: any) => {
      const currentQuantity = item.quantity_delivered || 0;
      const newQuantity = quantities[item.id] || 0;
      return newQuantity !== currentQuantity;
    });
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Edit className="w-5 h-5 text-blue-500" />
          <span>Editar Cantidades de Entrega</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Importante:</strong> Solo puedes editar las cantidades mientras la entrega esté pendiente 
            o en revisión de calidad. Una vez procesada, no se podrán hacer cambios.
          </AlertDescription>
        </Alert>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cantidad Ordenada</TableHead>
                <TableHead className="text-center">Cantidad Actual</TableHead>
                <TableHead className="text-center">Nueva Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveryData.delivery_items?.map((item: any) => {
                const productInfo = getProductInfo(item);
                const itemId = item.id;
                const currentQuantity = item.quantity_delivered || 0;
                const newQuantity = quantities[itemId] || 0;
                const hasError = errors[itemId];
                
                return (
                  <TableRow key={itemId}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-black">
                          {productInfo.productName}
                        </p>
                        <p className="text-sm text-gray-600">
                          {productInfo.variantSize} - {productInfo.variantColor}
                        </p>
                        <p className="text-xs text-gray-500">
                          {productInfo.skuVariant}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-gray-600">
                        {productInfo.maxQuantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-medium text-blue-600">
                        {currentQuantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          type="number"
                          min="0"
                          max={productInfo.maxQuantity}
                          value={newQuantity}
                          onChange={(e) => handleQuantityChange(itemId, e.target.value)}
                          className={`w-20 text-center ${hasError ? 'border-red-500' : ''}`}
                        />
                        {hasError && (
                          <p className="text-xs text-red-600">{hasError}</p>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || hasErrors || !hasChanges()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeliveryQuantityEditor;
