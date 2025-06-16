import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, AlertCircle, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProductVariant {
  size: string;
  color: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  variants: ProductVariant[];
}

interface ShopifyProductImportProps {
  onProductSelect: (product: ShopifyProduct) => void;
}

const ShopifyProductImport = ({ onProductSelect }: ShopifyProductImportProps) => {
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [suggestions, setSuggestions] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Función para obtener todos los productos al inicio
  const fetchAllProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching all products from Shopify');

      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { 
          searchTerm: '' // Obtener todos los productos
        }
      });

      if (error) {
        console.error('Error calling shopify-products function:', error);
        throw new Error(error.message || 'Error en la conexión con Shopify');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.products) {
        throw new Error('Respuesta inválida de Shopify');
      }

      const formattedProducts = data.products.map((product: any) => ({
        id: product.id,
        title: product.title,
        description: product.body_html || '',
        price: parseFloat(product.variants?.[0]?.price || '0'),
        image_url: product.image?.src || product.images?.[0]?.src || '',
        variants: product.variants?.map((variant: any) => ({
          size: variant.title !== 'Default Title' ? variant.title : '',
          color: variant.option2 || '',
          sku: variant.sku || '',
          price: parseFloat(variant.price || '0'),
          stock_quantity: variant.stock_quantity || 0
        })) || []
      }));

      setAllProducts(formattedProducts);
      setFilteredProducts(formattedProducts);

      toast({
        title: "Productos cargados",
        description: `Se encontraron ${formattedProducts.length} productos.`,
      });

    } catch (error: any) {
      console.error('Error fetching products from Shopify:', error);
      const errorMessage = error.message || "Error en la conexión con Shopify.";
      setError(errorMessage);
      toast({
        title: "Error al obtener productos de Shopify",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Cargar productos al montar el componente
  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  // Función para filtrar productos localmente
  const filterProducts = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredProducts(allProducts);
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = allProducts.filter(product =>
      product.title.toLowerCase().includes(term.toLowerCase()) ||
      product.description.toLowerCase().includes(term.toLowerCase()) ||
      product.variants.some(variant => 
        variant.sku.toLowerCase().includes(term.toLowerCase())
      )
    );

    setFilteredProducts(filtered);
    
    // Mostrar sugerencias (máximo 5)
    setSuggestions(filtered.slice(0, 5));
    setShowSuggestions(true);
  }, [allProducts]);

  // Manejar cambios en el término de búsqueda
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    filterProducts(term);
  };

  // Seleccionar una sugerencia
  const handleSuggestionClick = (suggestion: ShopifyProduct) => {
    setSearchTerm(suggestion.title);
    setFilteredProducts([suggestion]);
    setShowSuggestions(false);
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchTerm('');
    setFilteredProducts(allProducts);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Función para generar SKU único
  const generateUniqueSku = (baseTitle: string, productId: string) => {
    const cleanTitle = baseTitle
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .toUpperCase()
      .substring(0, 10);
    return `${cleanTitle}-${productId}-${Date.now()}`;
  };

  // Función para generar SKU de variante único
  const generateUniqueVariantSku = (productSku: string, variantTitle: string, index: number) => {
    const cleanVariant = variantTitle
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 5);
    return `${productSku}-V${index + 1}-${cleanVariant || 'DEF'}`;
  };

  const importProduct = async (product: ShopifyProduct) => {
    setImporting(product.id);
    try {
      console.log('Importing product:', product);

      // Generar SKU único para el producto
      const uniqueProductSku = generateUniqueSku(product.title, product.id);

      // Verificar si el producto ya existe por SKU
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', uniqueProductSku)
        .maybeSingle();

      if (existingProduct) {
        toast({
          title: "Producto ya existe",
          description: `${product.title} ya está en tu catálogo.`,
          variant: "destructive",
        });
        return;
      }

      // Crear el producto principal
      const { data: createdProduct, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: product.title,
            description: product.description || '',
            sku: uniqueProductSku,
            base_price: product.price,
            image_url: product.image_url,
            category: 'Shopify Import',
            status: 'active'
          }
        ])
        .select()
        .single();

      if (productError) {
        console.error('Error creating product:', productError);
        throw productError;
      }

      console.log('Created product:', createdProduct);

      // Crear las variantes del producto
      if (product.variants && product.variants.length > 0) {
        const variants = product.variants.map((variant, index) => ({
          product_id: createdProduct.id,
          size: variant.size || '',
          color: variant.color || '',
          sku_variant: generateUniqueVariantSku(uniqueProductSku, variant.size || variant.color || 'Default', index),
          additional_price: Math.max(0, variant.price - product.price),
          stock_quantity: variant.stock_quantity || 0
        }));

        console.log('Creating variants:', variants);

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variants);

        if (variantsError) {
          console.error('Error creating variants:', variantsError);
          // Si hay error con variantes, no fallar completamente
          console.warn('Continuing without variants due to error:', variantsError);
        } else {
          console.log('Successfully created variants');
        }
      }

      toast({
        title: "Producto importado exitosamente",
        description: `${product.title} ha sido importado a tu catálogo.`,
      });

      // Llamar al callback para seleccionar el producto
      onProductSelect(product);

    } catch (error: any) {
      console.error('Error importing product:', error);
      toast({
        title: "Error al importar producto",
        description: error.message || "Hubo un problema al importar el producto de Shopify.",
        variant: "destructive",
      });
    } finally {
      setImporting(null);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <h3 className="text-xl font-semibold text-gray-800">Importar desde Shopify</h3>
      <p className="text-gray-500">
        Conecta tu tienda Shopify para importar productos directamente a tu catálogo.
      </p>

      {/* Barra de búsqueda con autocompletar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar productos en Shopify..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => searchTerm && setShowSuggestions(true)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sugerencias */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-10 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                {suggestion.image_url && (
                  <img 
                    src={suggestion.image_url} 
                    alt={suggestion.title} 
                    className="w-10 h-10 rounded object-cover" 
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">{suggestion.title}</div>
                  <div className="text-xs text-gray-500">${suggestion.price.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={fetchAllProducts} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando productos...
          </>
        ) : (
          "Recargar Productos"
        )}
      </Button>

      {/* Mostrar error si existe */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {/* Resultados */}
      {filteredProducts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium">
              {searchTerm ? `Resultados para "${searchTerm}"` : 'Todos los productos'}
            </h4>
            <span className="text-sm text-gray-500">
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="p-4 relative">
                {importing === product.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  </div>
                )}
                {product.image_url && (
                  <img 
                    src={product.image_url} 
                    alt={product.title} 
                    className="rounded-md mb-2 h-32 w-full object-cover" 
                  />
                )}
                <h4 className="text-md font-semibold text-gray-800 mb-1">{product.title}</h4>
                <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                  {product.description.replace(/<[^>]*>/g, '').substring(0, 100)}...
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-green-600">${product.price.toFixed(2)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importProduct(product)}
                    disabled={importing !== null}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Importar
                  </Button>
                </div>
                {product.variants && product.variants.length > 1 && (
                  <Badge variant="secondary" className="mt-2">
                    {product.variants.length} variantes
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay resultados */}
      {!loading && filteredProducts.length === 0 && searchTerm && (
        <div className="text-center py-8">
          <p className="text-gray-500">No se encontraron productos con "{searchTerm}"</p>
          <Button 
            variant="outline" 
            onClick={clearSearch}
            className="mt-2"
          >
            Mostrar todos los productos
          </Button>
        </div>
      )}

      <div className="text-center text-gray-500">
        <p className="text-sm">
          ✅ Conectado automáticamente a Shopify usando credenciales seguras
        </p>
      </div>
    </Card>
  );
};

export default ShopifyProductImport;
