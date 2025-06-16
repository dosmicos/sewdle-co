import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ShopifyProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  variants: Array<{ size: string; color: string; price: string; sku: string }>;
  image?: string;
  sku?: string;
  category?: string;
  brand?: string;
  specifications?: string;
  status: 'active' | 'draft';
}

interface ShopifyProductImportProps {
  onProductSelect: (product: ShopifyProduct) => void;
}

const ShopifyProductImport = ({ onProductSelect }: ShopifyProductImportProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [shopifyCredentials, setShopifyCredentials] = useState({
    storeDomain: '',
    accessToken: ''
  });
  const { toast } = useToast();

  const callShopifyFunction = async (searchTerm = '') => {
    const { data, error } = await supabase.functions.invoke('shopify-products', {
      body: {
        storeDomain: shopifyCredentials.storeDomain,
        accessToken: shopifyCredentials.accessToken,
        searchTerm: searchTerm
      }
    });

    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(error.message || 'Error calling Shopify function');
    }

    return data;
  };

  const connectToShopify = async () => {
    if (!shopifyCredentials.storeDomain || !shopifyCredentials.accessToken) {
      toast({
        title: "Credenciales requeridas",
        description: "Por favor ingresa el dominio de la tienda y el token de acceso",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Connecting to Shopify via Edge function...');

      const data = await callShopifyFunction();

      if (!data.products) {
        throw new Error('No se encontraron productos en la respuesta de Shopify');
      }

      // Convertir productos de Shopify al formato interno
      const shopifyProducts: ShopifyProduct[] = data.products.map((product: any) => ({
        id: product.id.toString(),
        name: product.title,
        description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '') : '',
        price: product.variants?.[0]?.price || '0.00',
        variants: product.variants?.map((variant: any) => ({
          size: variant.option1 || variant.title || '',
          color: variant.option2 || '',
          price: variant.price || '0.00',
          sku: variant.sku || ''
        })) || [],
        image: product.images?.[0]?.src || '',
        sku: product.variants?.[0]?.sku || '',
        category: product.product_type || '',
        brand: product.vendor || '',
        specifications: product.body_html || '',
        status: product.status === 'active' ? 'active' : 'draft'
      }));

      setProducts(shopifyProducts);
      setIsConnected(true);
      setIsLoading(false);
      
      toast({
        title: "Conectado exitosamente",
        description: `Se encontraron ${shopifyProducts.length} productos (activos y en borrador)`
      });
    } catch (error) {
      console.error('Error connecting to Shopify:', error);
      setIsLoading(false);
      toast({
        title: "Error de conexión",
        description: error instanceof Error ? error.message : "No se pudo conectar con Shopify. Verifica tus credenciales.",
        variant: "destructive"
      });
    }
  };

  const fetchShopifyProducts = async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const data = await callShopifyFunction(searchTerm);
      
      // Convertir productos de Shopify al formato interno
      const shopifyProducts: ShopifyProduct[] = data.products.map((product: any) => ({
        id: product.id.toString(),
        name: product.title,
        description: product.body_html ? product.body_html.replace(/<[^>]*>/g, '') : '',
        price: product.variants?.[0]?.price || '0.00',
        variants: product.variants?.map((variant: any) => ({
          size: variant.option1 || variant.title || '',
          color: variant.option2 || '',
          price: variant.price || '0.00',
          sku: variant.sku || ''
        })) || [],
        image: product.images?.[0]?.src || '',
        sku: product.variants?.[0]?.sku || '',
        category: product.product_type || '',
        brand: product.vendor || '',
        specifications: product.body_html || '',
        status: product.status === 'active' ? 'active' : 'draft'
      }));

      setProducts(shopifyProducts);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setIsLoading(false);
      toast({
        title: "Error al buscar productos",
        description: "No se pudieron cargar los productos de Shopify",
        variant: "destructive"
      });
    }
  };

  const handleSearch = () => {
    if (!isConnected) {
      toast({
        title: "No conectado",
        description: "Primero debes conectarte a Shopify",
        variant: "destructive"
      });
      return;
    }
    fetchShopifyProducts();
  };

  if (!isConnected) {
    return (
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExternalLink className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">Conectar con Shopify</h3>
            <p className="text-gray-600 mb-6">
              Conecta tu tienda de Shopify para importar productos activos y en borrador
            </p>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <Label htmlFor="storeDomain" className="text-black">Dominio de la tienda</Label>
              <Input
                id="storeDomain"
                value={shopifyCredentials.storeDomain}
                onChange={(e) => setShopifyCredentials(prev => ({ ...prev, storeDomain: e.target.value }))}
                placeholder="mitienda.myshopify.com"
                className="text-black"
              />
            </div>
            
            <div>
              <Label htmlFor="accessToken" className="text-black">Token de acceso privado</Label>
              <Input
                id="accessToken"
                type="password"
                value={shopifyCredentials.accessToken}
                onChange={(e) => setShopifyCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                placeholder="shppa_..."
                className="text-black"
              />
            </div>

            <Button 
              onClick={connectToShopify}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? 'Conectando...' : 'Conectar Shopify'}
            </Button>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-900">Configuración requerida</p>
                <p className="text-sm text-blue-700 mt-1">
                  Necesitas un token de acceso privado con permisos de lectura de productos desde tu panel de Shopify.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-black flex items-center gap-2">
            <Package className="w-5 h-5" />
            Productos de Shopify (Activos y Borrador)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search" className="text-black">Buscar productos</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                <Input
                  id="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre del producto, SKU..."
                  className="pl-10 text-black"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isLoading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>

          {products.length > 0 && (
            <div className="space-y-4">
              {products.map((product) => (
                <Card key={product.id} className="border border-gray-200 hover:border-blue-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-black">{product.name}</h4>
                          <Badge 
                            variant={product.status === 'active' ? 'default' : 'secondary'}
                            className={product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                          >
                            {product.status === 'active' ? 'Activo' : 'Borrador'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="secondary" className="text-xs">
                            SKU: {product.sku}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {product.variants.length} variantes
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            ${product.price}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => onProductSelect(product)}
                        size="sm"
                        className="bg-blue-500 hover:bg-blue-600 text-white ml-4"
                      >
                        Seleccionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {products.length === 0 && !isLoading && searchTerm && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No se encontraron productos activos o en borrador</p>
            </div>
          )}

          {products.length === 0 && !isLoading && !searchTerm && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Haz clic en "Buscar" para cargar todos los productos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyProductImport;
