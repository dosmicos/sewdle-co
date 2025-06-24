
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_variants: {
    id: string;
    sku_variant: string;
    size: string;
    color: string;
    products: {
      name: string;
    };
  };
}

interface OrderQuantityEditorProps {
  orderItems: OrderItem[];
  onSave: (updatedItems: { id: string; quantity: number; total_price: number }[]) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

const OrderQuantityEditor = ({ orderItems, onSave, onCancel, loading }: OrderQuantityEditorProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    orderItems.forEach(item => {
      initialQuantities[item.id] = item.quantity;
    });
    setQuantities(initialQuantities);
  }, [orderItems]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    setQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const handleSave = async () => {
    const updatedItems = orderItems.map(item => {
      const newQuantity = quantities[item.id] || 0;
      return {
        id: item.id,
        quantity: newQuantity,
        total_price: newQuantity * item.unit_price
      };
    });

    // Validar que al menos un item tenga cantidad mayor a 0
    const hasValidQuantities = updatedItems.some(item => item.quantity > 0);
    if (!hasValidQuantities) {
      toast({
        title: "Error de validación",
        description: "Al menos un producto debe tener una cantidad mayor a 0.",
        variant: "destructive",
      });
      return;
    }

    const success = await onSave(updatedItems);
    if (success) {
      onCancel(); // Cerrar el editor después de guardar exitosamente
    }
  };

  const getTotalQuantity = () => {
    return Object.values(quantities).reduce((total, qty) => total + (qty || 0), 0);
  };

  const hasChanges = () => {
    return orderItems.some(item => quantities[item.id] !== item.quantity);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Package className="w-5 h-5" />
          <span>Editar Cantidades de Producción</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>Total de productos: <span className="font-medium">{getTotalQuantity()} unidades</span></p>
          <p className="text-xs mt-1">Modifica las cantidades según las necesidades de producción.</p>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="w-32">Cantidad</TableHead>
                <TableHead className="text-right">Precio Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.product_variants.products.name}
                  </TableCell>
                  <TableCell>
                    {item.product_variants.size} - {item.product_variants.color}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.product_variants.sku_variant}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(item.id, Math.max(0, (quantities[item.id] || 0) - 1))}
                        disabled={loading || (quantities[item.id] || 0) <= 0}
                        className="w-8 h-8 p-0"
                      >
                        -
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        value={quantities[item.id] || 0}
                        onChange={(e) => handleQuantityChange(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-16 text-center"
                        disabled={loading}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuantityChange(item.id, (quantities[item.id] || 0) + 1)}
                        disabled={loading}
                        className="w-8 h-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.unit_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${((quantities[item.id] || 0) * item.unit_price).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Cancelar</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !hasChanges()}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Guardando...' : 'Guardar Cambios'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderQuantityEditor;
