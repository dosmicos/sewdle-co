
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink, Package, AlertCircle } from 'lucide-react';

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
}

interface ShopifyProductImportProps {
  onProductSelect: (product: ShopifyProduct) => void;
}

const ShopifyProductImport = ({ onProductSelect }: ShopifyProductImportProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Productos de ejemplo para la interfaz
  const mockProducts: ShopifyProduct[] = [
    {
      id: '1',
      name: 'Camiseta Premium Cotton',
      description: 'Camiseta de algodón premium con corte regular',
      price: '$29.99',
      variants: [
        { size: 'S', color: 'Blanco', price: '$29.99', sku: 'CAM-001-S-W' },
        { size: 'M', color: 'Blanco', price: '$29.99', sku: 'CAM-001-M-W' },
        { size: 'L', color: 'Negro', price: '$29.99', sku: 'CAM-001-L-B' }
      ],
      sku: 'CAM-001',
      category: 'Ropa',
      brand: 'Mi Marca'
    }
  ];

  const handleSearch = () => {
    if (!isConnected) {
      // Simular conexión
      setIsLoading(true);
      setTimeout(() => {
        setProducts(mockProducts);
        setIsLoading(false);
      }, 1000);
      return;
    }
    
    setIsLoading(true);
    // Aquí se implementará la búsqueda real en Shopify
    setTimeout(() => {
      setProducts(mockProducts.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
      setIsLoading(false);
    }, 1000);
  };

  const connectToShopify = () => {
    // Simular conexión a Shopify
    setIsLoading(true);
    setTimeout(() => {
      setIsConnected(true);
      setIsLoading(false);
    }, 2000);
  };

  if (!isConnected) {
    return (
      <Card className="bg-gray-50 border-2 border-dashed border-gray-300">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-8 h-8 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-black">Conectar con Shopify</h3>
          <p className="text-gray-600 mb-6">
            Conecta tu tienda de Shopify para importar productos existentes
          </p>
          <Button 
            onClick={connectToShopify}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Conectando...' : 'Conectar Shopify'}
          </Button>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-medium text-blue-900">¿Qué necesitas?</p>
                <p className="text-sm text-blue-700 mt-1">
                  Tu dominio de Shopify y un token de acceso privado con permisos de lectura de productos.
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
            Productos de Shopify
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
                        <h4 className="font-medium text-black">{product.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge variant="secondary" className="text-xs">
                            SKU: {product.sku}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {product.variants.length} variantes
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {product.price}
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
              <p className="text-gray-600">No se encontraron productos</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyProductImport;
