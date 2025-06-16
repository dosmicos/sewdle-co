
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductSelectorProps {
  selectedProducts: any[];
  onProductsChange: (products: any[]) => void;
}

interface Product {
  id: string;
  name: string;
  description: string;
  base_price: number;
  variants: ProductVariant[];
}

interface ProductVariant {
  id: string;
  size: string;
  color: string;
  additional_price: number;
  stock_quantity: number;
}

const ProductSelector = ({ selectedProducts, onProductsChange }: ProductSelectorProps) => {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          base_price,
          product_variants (
            id,
            size,
            color,
            additional_price,
            stock_quantity
          )
        `)
        .eq('status', 'active');

      if (productsError) {
        console.error('Error fetching products:', productsError);
        return;
      }

      const formattedProducts = products?.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        base_price: product.base_price || 0,
        variants: product.product_variants || []
      })) || [];

      console.log('Fetched products from database:', formattedProducts);
      setAvailableProducts(formattedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProduct = () => {
    const newProduct = {
      id: Date.now().toString(),
      productId: '',
      variantId: '',
      quantity: 1,
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
          updated[index].unitPrice = selectedProduct.base_price + (selectedVariant.additional_price || 0);
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

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">Cargando productos...</p>
      </div>
    );
  }

  if (availableProducts.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-600">No hay productos disponibles. Crea productos primero en la sección de Productos.</p>
      </div>
    );
  }

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

              {selectedProductData && selectedProductData.variants.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Variante (Talla/Color)
                  </label>
                  <Select
                    value={product.variantId || "none"}
                    onValueChange={(value) => updateProduct(index, 'variantId', value === "none" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar variante..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar variante...</SelectItem>
                      {selectedProductData.variants.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.size && variant.color 
                            ? `${variant.size} - ${variant.color} - $${(selectedProductData.base_price + (variant.additional_price || 0)).toLocaleString()}`
                            : variant.size || variant.color || `Variante - $${(selectedProductData.base_price + (variant.additional_price || 0)).toLocaleString()}`
                          }
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
                    Descripción
                  </label>
                  <Input
                    value={selectedProductData.description}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Precio Base
                  </label>
                  <Input
                    value={`$${selectedProductData.base_price.toLocaleString()}`}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Precio Final
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Cantidad
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max={selectedVariant.stock_quantity || 999}
                    value={product.quantity || ''}
                    onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Ingresa la cantidad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-black mb-2">
                    Stock Disponible
                  </label>
                  <Input
                    value={selectedVariant.stock_quantity || 0}
                    readOnly
                    className="bg-gray-50"
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

            {selectedProductData && selectedProductData.variants.length === 0 && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  Este producto no tiene variantes configuradas. Crea variantes para este producto en la sección de Productos.
                </p>
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

      {selectedProducts.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Resumen de productos:</h4>
          {selectedProducts.map((product, index) => {
            const productData = getSelectedProduct(product.productId);
            const variantData = getSelectedVariant(product.productId, product.variantId);
            
            if (!productData || !variantData) return null;
            
            return (
              <div key={index} className="text-sm text-blue-800">
                {productData.name} - {variantData.size || 'Sin talla'} {variantData.color || ''} - Cantidad: {product.quantity} - Total: ${(product.quantity * product.unitPrice).toLocaleString()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductSelector;
