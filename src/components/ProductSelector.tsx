
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
  // Mock data for products
  const availableProducts = [
    {
      id: '1',
      name: 'Ruana de Leoncito',
      design: 'Modelo Primavera 2025',
      color: 'Azul Marino',
      sizes: [
        { size: '10 (6 - 7 años)', ageRange: '6-7 años' },
        { size: '12 (8 - 9 años)', ageRange: '8-9 años' },
        { size: '2 (3 - 12 meses)', ageRange: '3-12 meses' },
        { size: '4 (1 - 2 años)', ageRange: '1-2 años' },
        { size: '6 (3 - 4 años)', ageRange: '3-4 años' },
        { size: '8 (4 - 5 años)', ageRange: '4-5 años' }
      ]
    },
    {
      id: '2',
      name: 'Camisa Básica',
      design: 'Diseño Clásico',
      color: 'Blanco',
      sizes: [
        { size: 'XS', ageRange: '2-3 años' },
        { size: 'S', ageRange: '4-5 años' },
        { size: 'M', ageRange: '6-7 años' },
        { size: 'L', ageRange: '8-9 años' }
      ]
    }
  ];

  const addProduct = () => {
    const newProduct = {
      id: Date.now().toString(),
      productId: '',
      quantities: {}
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
    
    // Si se cambia el producto, resetear las cantidades
    if (field === 'productId') {
      updated[index].quantities = {};
    }
    
    onProductsChange(updated);
  };

  const updateQuantity = (productIndex: number, size: string, quantity: string) => {
    const updated = [...selectedProducts];
    updated[productIndex].quantities = {
      ...updated[productIndex].quantities,
      [size]: parseInt(quantity) || 0
    };
    onProductsChange(updated);
  };

  const getSelectedProduct = (productId: string) => {
    return availableProducts.find(p => p.id === productId);
  };

  return (
    <div className="space-y-6">
      {selectedProducts.map((product, index) => {
        const selectedProductData = getSelectedProduct(product.productId);
        
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                <>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Diseño
                    </label>
                    <Input
                      value={selectedProductData.design}
                      placeholder="Ej: Modelo Primavera 2025"
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
                      placeholder="Ej: Azul Marino"
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </>
              )}
            </div>

            {selectedProductData && (
              <div>
                <h5 className="font-medium text-black mb-3">Tallas y Cantidades</h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedProductData.sizes.map((sizeData) => (
                    <div key={sizeData.size} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-black">
                          {sizeData.size}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          value={product.quantities[sizeData.size] || 0}
                          onChange={(e) => updateQuantity(index, sizeData.size, e.target.value)}
                          className="w-20 text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ))}
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
