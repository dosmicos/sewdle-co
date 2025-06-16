import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Package, Download, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  vendor: string;
  images: Array<{
    src: string;
    alt: string;
  }>;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku: string;
    inventory_quantity: number;
    option1: string;
    option2: string;
    option3: string;
    stock_quantity?: number;
  }>;
  options: Array<{
    name: string;
    values: string[];
  }>;
}

interface ShopifyProductImportProps {
  open: boolean;
  onClose: () => void;
  onProductImported: () => void;
}

const ShopifyProductImport = ({ open, onClose, onProductImported }: ShopifyProductImportProps) => {
  const [storeDomain, setStoreDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Cargar credenciales guardadas al abrir el modal
    if (open) {
      loadSavedCredentials();
    }
  }, [open]);

  const loadSavedCredentials = async () => {
    try {
      const { data: secrets } = await supabase.functions.invoke('get-secrets');
      if (secrets) {
        setStoreDomain(secrets.SHOPIFY_STORE_DOMAIN || '');
        setAccessToken(secrets.SHOPIFY_ACCESS_TOKEN || '');
        if (secrets.SHOPIFY_STORE_DOMAIN && secrets.SHOPIFY_ACCESS_TOKEN) {
          setConnected(true);
        }
      }
    } catch (error) {
      console.log('No hay credenciales guardadas');
    }
  };

  const connectToShopify = async () => {
    if (!storeDomain || !accessToken) {
      toast({
        title: "Credenciales requeridas",
        description: "Por favor ingresa el dominio de la tienda y el token de acceso.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { 
          storeDomain: storeDomain.trim(),
          accessToken: accessToken.trim(),
          searchTerm: ''
        }
      });

      if (error) throw error;

      if (data.products) {
        setProducts(data.products);
        setConnected(true);
        toast({
          title: "Conectado exitosamente",
          description: `Se encontraron ${data.products.length} productos en tu tienda Shopify.`
        });
      }
    } catch (error) {
      console.error('Error connecting to Shopify:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar a Shopify. Verifica tus credenciales.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async () => {
    if (!connected) {
      await connectToShopify();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { 
          storeDomain: storeDomain.trim(),
          accessToken: accessToken.trim(),
          searchTerm: searchTerm.trim()
        }
      });

      if (error) throw error;

      setProducts(data.products || []);
    } catch (error) {
      console.error('Error searching products:', error);
      toast({
        title: "Error en la búsqueda",
        description: "No se pudieron buscar los productos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const importProduct = async (product: ShopifyProduct) => {
    setImporting(product.id);
    
    try {
      console.log('Importing product:', product);

      // Crear el producto en la base de datos
      const { data: createdProduct, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: product.title,
            description: `Producto importado desde Shopify - ${product.product_type}`,
            sku: product.handle,
            category: product.product_type || 'General',
            price: parseFloat(product.variants[0]?.price || '0'),
            image_url: product.images[0]?.src || null,
            shopify_product_id: product.id.toString(),
            vendor: product.vendor || null
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
        const variants = product.variants.map(variant => {
          // Obtener las opciones de la variante
          const options = product.options || [];
          const variantOptions: { [key: string]: string } = {};
          
          if (options[0] && variant.option1) variantOptions[options[0].name.toLowerCase()] = variant.option1;
          if (options[1] && variant.option2) variantOptions[options[1].name.toLowerCase()] = variant.option2;
          if (options[2] && variant.option3) variantOptions[options[2].name.toLowerCase()] = variant.option3;

          return {
            product_id: createdProduct.id,
            size: variantOptions['size'] || variantOptions['talla'] || variant.option1 || 'Única',
            color: variantOptions['color'] || variantOptions['colour'] || variant.option2 || 'Único',
            sku: variant.sku || `${product.handle}-${variant.id}`,
            price: parseFloat(variant.price || '0'),
            stock_quantity: variant.stock_quantity || variant.inventory_quantity || 0,
            shopify_variant_id: variant.id.toString()
          };
        });

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
        title: "Producto importado",
        description: `${product.title} ha sido importado exitosamente con ${product.variants.length} variantes.`
      });

      onProductImported();

    } catch (error) {
      console.error('Error importing product:', error);
      toast({
        title: "Error al importar",
        description: "No se pudo importar el producto. Intenta de nuevo.",
        variant: "destructive"
      });
    } finally {
      setImporting(null);
    }
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(parseFloat(price) * 1000); // Asumiendo conversión aproximada
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            Importar Productos desde Shopify
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!connected ? (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-black">Conectar con Shopify</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeDomain">Dominio de la tienda</Label>
                  <Input
                    id="storeDomain"
                    placeholder="mi-tienda.myshopify.com"
                    value={storeDomain}
                    onChange={(e) => setStoreDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessToken">Token de acceso privado</Label>
                  <Input
                    id="accessToken"
                    type="password"
                    placeholder="shpat_..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={connectToShopify}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 mr-2" />
                      Conectar con Shopify
                    </>
                  )}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-4 bg-green-50 border-green-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-800 font-medium">
                    Conectado a {storeDomain}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConnected(false)}
                    className="ml-auto text-green-700 hover:text-green-900"
                  >
                    Cambiar credenciales
                  </Button>
                </div>
              </Card>

              <div className="flex space-x-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                  />
                </div>
                <Button 
                  onClick={searchProducts}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {products.length > 0 && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {products.map((product) => (
                    <Card key={product.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start space-x-4">
                        {product.images[0] && (
                          <img 
                            src={product.images[0].src} 
                            alt={product.title}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-black">{product.title}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="secondary">{product.product_type}</Badge>
                                <Badge variant="outline">{product.vendor}</Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {product.variants.length} variante(s) • 
                                Desde {formatPrice(product.variants[0]?.price || '0')}
                              </p>
                            </div>
                            <Button
                              onClick={() => importProduct(product)}
                              disabled={importing === product.id}
                              className="bg-blue-500 hover:bg-blue-600 text-white"
                            >
                              {importing === product.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Importando...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 mr-2" />
                                  Importar
                                </>
                              )}
                            </Button>
                          </div>
                          
                          <div className="mt-3 space-y-2">
                            <p className="text-sm font-medium text-gray-700">Variantes:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {product.variants.slice(0, 4).map((variant, index) => (
                                <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                                  <div className="flex justify-between">
                                    <span className="font-medium">
                                      {variant.option1}{variant.option2 ? ` - ${variant.option2}` : ''}
                                    </span>
                                    <span className="text-gray-600">
                                      Stock: {variant.stock_quantity || variant.inventory_quantity || 0}
                                    </span>
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-gray-600">SKU: {variant.sku}</span>
                                    <span className="font-medium">{formatPrice(variant.price)}</span>
                                  </div>
                                </div>
                              ))}
                              {product.variants.length > 4 && (
                                <div className="text-xs text-gray-500 p-2">
                                  +{product.variants.length - 4} variantes más...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShopifyProductImport;
