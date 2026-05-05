import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Package, Save, X, Trash2, Undo2 } from 'lucide-react';
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
  onSave: (updatedItems: { id: string; quantity: number; total_price: number }[], deletedItemIds: string[]) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
}

const OrderQuantityEditor = ({ orderItems, onSave, onCancel, loading }: OrderQuantityEditorProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    const initialQuantities: Record<string, number> = {};
    orderItems.forEach(item => {
      initialQuantities[item.id] = item.quantity;
    });
    setQuantities(initialQuantities);
    setRemovedItems(new Set()); // Reset removed items when orderItems change
  }, [orderItems]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    setQuantities(prev => ({
      ...prev,
      [itemId]: newQuantity
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setRemovedItems(prev => new Set([...prev, itemId]));
  };

  const handleRestoreItem = (itemId: string) => {
    setRemovedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  };

  const handleSave = async () => {
    const activeItems = orderItems.filter(item => !removedItems.has(item.id));
    const updatedItems = activeItems.map(item => ({
      id: item.id,
      quantity: quantities[item.id] || 0,
      total_price: (quantities[item.id] || 0) * item.unit_price
    })).filter(item => item.quantity > 0);

    const deletedItemIds = Array.from(removedItems);

    // Validation: ensure at least one item remains after deletions and zero quantities
    if (updatedItems.length === 0 && deletedItemIds.length > 0) {
      toast({
        title: "Error",
        description: "No se puede eliminar todas las variantes. Debe quedar al menos una con cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    if (updatedItems.length === 0) {
      toast({
        title: "Error", 
        description: "Debe haber al menos un producto con cantidad mayor a 0",
        variant: "destructive",
      });
      return;
    }

    const success = await onSave(updatedItems, deletedItemIds);
    if (success) {
      onCancel(); // Close editor after successful save
    }
  };

  const getTotalQuantity = () => {
    return Object.values(quantities).reduce((total, qty) => total + (qty || 0), 0);
  };

  const hasChanges = () => {
    return orderItems.some(item => quantities[item.id] !== item.quantity) || removedItems.size > 0;
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
                <TableHead className="w-20">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderItems.map((item) => {
                const currentQuantity = quantities[item.id] || 0;
                const totalPrice = currentQuantity * item.unit_price;
                const isRemoved = removedItems.has(item.id);
                
                return (
                  <TableRow key={item.id} className={isRemoved ? 'opacity-50 bg-muted/20' : ''}>
                    <TableCell className="font-medium">
                      <div className={isRemoved ? 'line-through' : ''}>
                        {item.product_variants.products.name}
                        {isRemoved && (
                          <div className="text-sm text-red-600 font-medium mt-1">Marcado para eliminar</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={isRemoved ? 'line-through' : ''}>
                      {item.product_variants.size} - {item.product_variants.color}
                    </TableCell>
                    <TableCell className={`text-sm text-gray-600 ${isRemoved ? 'line-through' : ''}`}>
                      {item.product_variants.sku_variant}
                    </TableCell>
                    <TableCell>
                      {!isRemoved ? (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, Math.max(0, currentQuantity - 1))}
                            disabled={loading || currentQuantity <= 0}
                            className="w-8 h-8 p-0"
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            value={currentQuantity}
                            onChange={(e) => handleQuantityChange(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 text-center"
                            disabled={loading}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuantityChange(item.id, currentQuantity + 1)}
                            disabled={loading}
                            className="w-8 h-8 p-0"
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">-</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      ${item.unit_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {!isRemoved ? `$${totalPrice.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {!isRemoved ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 w-8 h-8 p-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar variante</AlertDialogTitle>
                              <AlertDialogDescription>
                                ¿Estás seguro de que deseas eliminar esta variante de la orden? Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveItem(item.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreItem(item.id)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 w-8 h-8 p-0"
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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