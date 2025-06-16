import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ExternalLink, Download } from 'lucide-react';
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
  const [storeDomain, setStoreDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cargar las credenciales desde localStorage al montar el componente
    const storedDomain = localStorage.getItem('shopifyStoreDomain');
    const storedToken = localStorage.getItem('shopifyAccessToken');

    if (storedDomain) setStoreDomain(storedDomain);
    if (storedToken) setAccessToken(storedToken);
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Guardar las credenciales en localStorage
      localStorage.setItem('shopifyStoreDomain', storeDomain);
      localStorage.setItem('shopifyAccessToken', accessToken);

      const response = await fetch(`https://${storeDomain}/admin/api/2023-10/products.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Products from Shopify:', data.products);

      const formattedProducts = data.products.map((product: any) => ({
        id: product.id,
        title: product.title,
        description: product.body_html,
        price: parseFloat(product.variants[0].price),
        image_url: product.image?.src || '',
        variants: product.variants.map((variant: any) => ({
          size: variant.title !== 'Default Title' ? variant.title : '',
          color: variant.option2 || '',
          sku: variant.sku,
          price: parseFloat(variant.price),
          stock_quantity: variant.inventory_quantity || 0
        }))
      }));

      setProducts(formattedProducts);

    } catch (error: any) {
      console.error('Error fetching products from Shopify:', error);
      toast({
        title: "Error al obtener productos de Shopify",
        description: error.message || "Credenciales inválidas o error en la conexión.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dominio de la tienda</label>
          <Input
            type="text"
            placeholder="ejemplo.myshopify.com"
            value={storeDomain}
            onChange={(e) => setStoreDomain(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Access Token</label>
          <Input
            type="password"
            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={fetchProducts} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando productos...
          </>
        ) : (
          "Obtener Productos"
        )}
      </Button>

      {products.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="p-4 relative">
              {importing === product.id && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-md">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                </div>
              )}
              <img src={product.image_url} alt={product.title} className="rounded-md mb-2 h-32 w-full object-cover" />
              <h4 className="text-md font-semibold text-gray-800">{product.title}</h4>
              <p className="text-gray-600 text-sm mb-2">{product.description.substring(0, 50)}...</p>
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
            </Card>
          ))}
        </div>
      )}

      <div className="text-center text-gray-500">
        <a
          href="https://shopify.dev/docs/api/usage/access-tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 hover:underline"
        >
          <ExternalLink className="w-4 h-4" />
          ¿Cómo obtener un Access Token de Shopify?
        </a>
      </div>
    </Card>
  );
};

export default ShopifyProductImport;
