
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Package } from 'lucide-react';
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

interface InternalSelectedProduct {
  tempId: string;
  productId: string;
  productName: string;
  variants: {
    [variantId: string]: {
      id: string;
      size: string;
      color: string;
      price: number;
      stock: number;
      quantity: number;
    };
  };
}

const ProductSelector = ({ selectedProducts, onProductsChange }: ProductSelectorProps) => {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalProducts, setInternalProducts] = useState<InternalSelectedProduct[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  // Sincronizar productos internos con los externos cuando cambian los productos seleccionados
  useEffect(() => {
    // Solo actualizar si los productos seleccionados externos no tienen la estructura interna
    if (selectedProducts.length === 0 || !selectedProducts.some(p => p.tempId)) {
      updateExternalProducts();
    }
  }, [internalProducts]);

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

  const updateExternalProducts = () => {
    const formattedProducts = internalProducts.flatMap((product: InternalSelectedProduct) => {
      if (!product.variants) return [];
      
      return Object.values(product.variants)
        .filter((variant: any) => variant.quantity > 0)
        .map((variant: any) => ({
          productId: product.productId,
          variantId: variant.id,
          quantity: variant.quantity,
          unitPrice: variant.price
        }));
    });

    console.log('Updating external products:', formattedProducts);
    onProductsChange(formattedProducts);
  };

  const addProduct = () => {
    const newProduct: InternalSelectedProduct = {
      tempId: `temp_${Date.now()}`,
      productId: '',
      productName: '',
      variants: {}
    };
    setInternalProducts(prev => [...prev, newProduct]);
  };

  const removeProduct = (index: number) => {
    setInternalProducts(prev => prev.filter((_, i) => i !== index));
  };

  const updateProductSelection = (index: number, productId: string) => {
    const selectedProduct = availableProducts.find(p => p.id === productId);
    if (!selectedProduct) return;

    console.log('Selected product:', selectedProduct);

    setInternalProducts(prev => {
      const updated = [...prev];
      const variants: any = {};
      
      // Inicializar todas las variantes con cantidad 0
      selectedProduct.variants.forEach(variant => {
        variants[variant.id] = {
          id: variant.id,
          size: variant.size || '',
          color: variant.color || '',
          price: selectedProduct.base_price + (variant.additional_price || 0),
          stock: variant.stock_quantity || 0,
          quantity: 0
        };
      });

      updated[index] = {
        ...updated[index],
        productId,
        productName: selectedProduct.name,
        variants
      };
      
      console.log('Updated internal products:', updated);
      return updated;
    });
  };

  const updateVariantQuantity = (productIndex: number, variantId: string, quantity: number) => {
    setInternalProducts(prev => {
      const updated = [...prev];
      if (updated[productIndex].variants[variantId]) {
        // Asegurar que la cantidad no sea negativa
        updated[productIndex].variants[variantId].quantity = Math.max(0, quantity);
      }
      return updated;
    });
  };

  const getProductQuantityTotal = (product: InternalSelectedProduct) => {
    return Object.values(product.variants).reduce((total: number, variant: any) => {
      return total + variant.quantity;
    }, 0);
  };

  const getTotalQuantities = () => {
    return internalProducts.reduce((total, product) => {
      return total + getProductQuantityTotal(product);
    }, 0);
  };

  const getStockDisplayClass = (stockQuantity: number) => {
    if (stockQuantity < 0) {
      return 'bg-red-100 text-red-800';
    } else if (stockQuantity === 0) {
      return 'bg-orange-100 text-orange-800';
    } else {
      return 'bg-green-100 text-green-800';
    }
  };

  const getStockDisplayText = (stockQuantity: number) => {
    if (stockQuantity < 0) {
      return `${stockQuantity} (Stock negativo)`;
    } else if (stockQuantity === 0) {
      return '0 (Agotado)';
    } else {
      return stockQuantity.toString();
    }
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
      {internalProducts.map((product: InternalSelectedProduct, index) => {
        const selectedProductData = availableProducts.find(p => p.id === product.productId);
        
        return (
          <div key={product.tempId} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-black flex items-center">
                <Package className="w-4 h-4 mr-2" />
                Producto #{index + 1}
              </h4>
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

            <div className="mb-4">
              <label className="block text-sm font-medium text-black mb-2">
                Seleccionar Producto
              </label>
              <Select
                value={product.productId || ""}
                onValueChange={(value) => updateProductSelection(index, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id}>
                      {prod.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProductData && selectedProductData.variants.length > 0 && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Precio Base:</strong> ${selectedProductData.base_price.toLocaleString()}
                  </p>
                  {selectedProductData.description && (
                    <p className="text-sm text-gray-700 mt-1">
                      <strong>Descripción:</strong> {selectedProductData.description}
                    </p>
                  )}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="text-black font-semibold">Variante</TableHead>
                        <TableHead className="text-black font-semibold">Precio</TableHead>
                        <TableHead className="text-black font-semibold">Disponible</TableHead>
                        <TableHead className="text-black font-semibold">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProductData.variants.map((variant) => {
                        const variantData = product.variants[variant.id];
                        const variantName = [variant.size, variant.color].filter(Boolean).join(' - ') || 'Variante estándar';
                        
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs text-blue-600 font-medium">
                                    {variant.size?.charAt(0) || variant.color?.charAt(0) || 'V'}
                                  </span>
                                </div>
                                <span>{variantName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              ${(selectedProductData.base_price + (variant.additional_price || 0)).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStockDisplayClass(variant.stock_quantity)}`}>
                                {getStockDisplayText(variant.stock_quantity)}
                              </span>
                              {variant.stock_quantity <= 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Se puede ordenar sin stock
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                value={variantData?.quantity || 0}
                                onChange={(e) => updateVariantQuantity(
                                  index, 
                                  variant.id, 
                                  parseInt(e.target.value) || 0
                                )}
                                className="w-20"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-center">
                    <span className="font-medium text-blue-900">
                      Total de cantidades: {getProductQuantityTotal(product)} unidades
                    </span>
                  </div>
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

      {internalProducts.length > 0 && (
        <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <h4 className="font-bold text-blue-900 mb-4 text-lg">Resumen de la Orden</h4>
          
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total de unidades a producir:</span>
              <span className="text-3xl font-bold text-blue-600">
                {getTotalQuantities()} unidades
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductSelector;
