import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Check, RefreshCw, Search, Link2, ExternalLink } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const ProductCatalogConnection = () => {
  const { products, loading, refetch } = useProducts();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [connectedProducts, setConnectedProducts] = React.useState<string[]>([]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleProduct = (productId: string) => {
    if (connectedProducts.includes(productId)) {
      setConnectedProducts(connectedProducts.filter(id => id !== productId));
    } else {
      setConnectedProducts([...connectedProducts, productId]);
    }
  };

  const handleConnectAll = () => {
    setConnectedProducts(products.map(p => p.id));
    toast.success('Todos los productos conectados');
  };

  const handleDisconnectAll = () => {
    setConnectedProducts([]);
    toast.success('Todos los productos desconectados');
  };

  const handleSync = () => {
    refetch();
    toast.success('Catálogo sincronizado');
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Connection Status */}
      <Card className="md:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" />
              <CardTitle>Conexión con Catálogo</CardTitle>
            </div>
            <Badge className="bg-green-500">
              <Check className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          </div>
          <CardDescription>
            La IA puede consultar información de productos en tiempo real para responder preguntas sobre disponibilidad, precios y características.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 text-center">
              <p className="text-2xl font-bold text-blue-600">{products.length}</p>
              <p className="text-sm text-blue-600">Productos totales</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-600">{connectedProducts.length}</p>
              <p className="text-sm text-green-600">Conectados a IA</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 text-center">
              <p className="text-2xl font-bold text-purple-600">
                {products.filter(p => p.status === 'active').length}
              </p>
              <p className="text-sm text-purple-600">Activos</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {products.reduce((acc, p) => {
                  const categories = new Set();
                  products.forEach(prod => prod.category && categories.add(prod.category));
                  return categories.size;
                }, 0)}
              </p>
              <p className="text-sm text-orange-600">Categorías</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Productos Disponibles</CardTitle>
              <CardDescription>
                Selecciona qué productos puede consultar la IA
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleConnectAll}>
                Conectar todos
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnectAll}>
                Desconectar todos
              </Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50"
                    style={{ borderColor: '#e5e7eb' }}
                  >
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium" style={{ color: '#1f2937' }}>
                          {product.name}
                        </p>
                        <p className="text-sm" style={{ color: '#6b7280' }}>
                          SKU: {product.sku}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                        {product.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Switch
                        checked={connectedProducts.includes(product.id)}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />
                    </div>
                  </div>
                ))}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto text-gray-300" />
                    <p className="mt-2 text-sm text-gray-500">No se encontraron productos</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Sync & Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Sincronización</CardTitle>
          <CardDescription>Mantén el catálogo actualizado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSync} variant="outline" className="w-full flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Sincronizar ahora
          </Button>

          <div className="p-4 rounded-lg bg-gray-50 space-y-3">
            <h4 className="font-medium text-sm">Información disponible para IA:</h4>
            <ul className="text-sm space-y-2" style={{ color: '#6b7280' }}>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Nombres y descripciones
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Precios base
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Disponibilidad (stock)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Variantes (tallas, colores)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Categorías
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: '#e5e7eb' }}>
            <Button variant="link" className="p-0 h-auto flex items-center gap-1 text-sm">
              <ExternalLink className="h-3 w-3" />
              Ver documentación de la API
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
