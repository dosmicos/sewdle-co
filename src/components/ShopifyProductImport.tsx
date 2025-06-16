
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ExternalLink, Download, AlertCircle } from 'lucide-react';
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
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cargar productos automáticamente al montar el componente
    fetchProducts();
  }, []);

  const fetchProducts = async (search = '') => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching products with search term:', search);

      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { 
          searchTerm: search 
        }
      });

      if (error) {
        console.error('Error calling shopify-products function:', error);
        throw new Error(error.message || 'Error en la conexión con Shopify');
      }

      console.log('Response from shopify-products function:', data);

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

      setProducts(formattedProducts);

      if (formattedProducts.length === 0) {
        toast({
          title: "Sin resultados",
          description: search ? "No se encontraron productos con ese término de búsqueda." : "No hay productos disponibles en tu tienda Shopify.",
        });
      } else {
        toast({
          title: "Productos cargados",
          description: `Se encontraron ${formattedProducts.length} productos.`,
        });
      }

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
  };

  const handleSearch = () => {
    fetchProducts(searchTerm);
  };

  const importProduct = async (product: ShopifyProduct) => {
    setImporting(product.id);
    try {
      console.log('Importing product:', product);

      // Crear el producto principal
      const { data: createdProduct, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: product.title,
            description: product.description || '',
            sku: `SHOPIFY-${product.id}`,
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
        const variants = product.variants.map(variant => ({
          product_id: createdProduct.id,
          size: variant.size,
          color: variant.color,
          sku_variant: variant.sku,
          additional_price: variant.price - product.price,
          stock_quantity: variant.stock_quantity
        }));

        console.log('Creating variants:', variants);

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variants);

        if (variantsError) {
          console.error('Error creating variants:', variantsError);
          throw variantsError;
        }

        console.log('Successfully created variants');
      }

      toast({
        title: "Producto importado exitosamente",
        description: `${product.title} ha sido importado a tu catálogo.`,
      });

      // Llamar al callback para seleccionar el producto
      onProductSelect(product);

    } catch (error) {
      console.error('Error importing product:', error);
      toast({
        title: "Error al importar producto",
        description: "Hubo un problema al importar el producto de Shopify.",
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

      {/* Barra de búsqueda */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar productos en Shopify..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Buscar"
          )}
        </Button>
      </div>

      <Button onClick={() => fetchProducts()} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando productos...
          </>
        ) : (
          "Obtener Todos los Productos"
        )}
      </Button>

      {/* Mostrar error si existe */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
      )}

      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
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
