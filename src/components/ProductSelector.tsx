
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

interface ProductSelectorProps {
  selectedProducts: any[];
  onProductsChange: (products: any[]) => void;
}

const ProductSelector = ({ selectedProducts, onProductsChange }: ProductSelectorProps) => {
  // Mock data for products with variants
  const availableProducts = [
    {
      id: '1',
      name: 'Ruana de Leoncito',
      design: 'Modelo Primavera 2025',
      color: 'Azul Marino',
      variants: [
        { id: 'var1-1', size: '2 (3 - 12 meses)', ageRange: '3-12 meses', price: 25000 },
        { id: 'var1-2', size: '4 (1 - 2 años)', ageRange: '1-2 años', price: 28000 },
        { id: 'var1-3', size: '6 (3 - 4 años)', ageRange: '3-4 años', price: 30000 },
        { id: 'var1-4', size: '8 (4 - 5 años)', ageRange: '4-5 años', price: 32000 },
        { id: 'var1-5', size: '10 (6 - 7 años)', ageRange: '6-7 años', price: 35000 },
        { id: 'var1-6', size: '12 (8 - 9 años)', ageRange: '8-9 años', price: 38000 }
      ]
    },
    {
      id: '2',
      name: 'Camisa Básica',
      design: 'Diseño Clásico',
      color: 'Blanco',
      variants: [
        { id: 'var2-1', size: 'XS', ageRange: '2-3 años', price: 20000 },
        { id: 'var2-2', size: 'S', ageRange: '4-5 años', price: 22000 },
        { id: 'var2-3', size: 'M', ageRange: '6-7 años', price: 24000 },
        { id: 'var2-4', size: 'L', ageRange: '8-9 años', price: 26000 }
      ]
    }
  ];

  const addProduct = () => {
    const newProduct = {
      id: Date.now().toString(),
      productId: '',
      variantId: '',
      quantity: 0,
      unitPrice: 0
    };
    onProductsChange([...selectedProducts, newProduct]);
  };

  const removeProduct = (index: number) => {
    const updated = selectedProducts.filter((_, i) => i !== index);
    onProductsChange(updated);
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = [...selectedProducts];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se cambia el producto, resetear variante y precio
    if (field === 'productId') {
      updated[index].variantId = '';
      updated[index].unitPrice = 0;
    }
    
    // Si se cambia la variante, actualizar el precio
    if (field === 'variantId') {
      const selectedProduct = getSelectedProduct(updated[index].productId);
      if (selectedProduct) {
        const selectedVariant = selectedProduct.variants.find(v => v.id === value);
        if (selectedVariant) {
          updated[index].unitPrice = selectedVariant.price;
        }
      }
    }
    
    onProductsChange(updated);
  };

  const getSelectedProduct = (productId: string) => {
    return availableProducts.find(p => p.id === productId);
  };

  const getSelectedVariant = (productId: string, variantId: string) => {
    const product = getSelectedProduct(productId);
    return product?.variants.find(v => v.id === variantId);
  };

  return (
    <div className="space-y-6">
      {selectedProducts.map((product, index) => {
        const selectedProductData = getSelectedProduct(product.productId);
        const selectedVariant = getSelectedVariant(product.productId, product.variantId);
        
        return (
          <div key={product.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-black">Producto #{index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeProduct(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Producto
                </label>
                <Select
                  value={product.productId || "none"}
                  onValueChange={(value) => updateProduct(index, 'productId', value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar producto...</SelectItem>
                    {availableProducts.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProductData && (
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Variante (Talla)
                  </label>
                  <Select
                    value={product.variantId || "none"}
                    onValueChange={(value) => updateProduct(index, 'variantId', value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar talla..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar talla...</SelectItem>
                      {selectedProductData.variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.size} - ${variant.price.toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedProductData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Diseño
                  </label>
                  <Input
                    value={selectedProductData.design}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Color
                  </label>
                  <Input
                    value={selectedProductData.color}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Precio Unitario
                  </label>
                  <Input
                    value={product.unitPrice ? `$${product.unitPrice.toLocaleString()}` : ''}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </div>
            )}

            {selectedVariant && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Cantidad
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={product.quantity || ''}
                    onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                    placeholder="Ingresa la cantidad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Total
                  </label>
                  <Input
                    value={product.quantity && product.unitPrice ? 
                      `$${(product.quantity * product.unitPrice).toLocaleString()}` : '$0'}
                    readOnly
                    className="bg-gray-50 font-semibold"
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addProduct}
        className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:text-black hover:border-gray-400"
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Producto
      </Button>
    </div>
  );
};

export default ProductSelector;
