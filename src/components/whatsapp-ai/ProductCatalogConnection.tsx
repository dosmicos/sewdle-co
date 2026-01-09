import React, { useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, Check, RefreshCw, Search, Link2, ExternalLink, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ShopifyVariant {
  id: number;
  title: string;
  sku: string;
  inventory_quantity: number;
  price: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  status: string;
  product_type: string;
  variants: ShopifyVariant[];
  image?: { src: string };
}

type StatusFilter = 'all' | 'active' | 'draft';
type StockFilter = 'all' | 'in-stock' | 'out-of-stock';

export const ProductCatalogConnection = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');

  // Fetch products directly from Shopify
  const { data: shopifyData, isLoading: loading, refetch } = useQuery({
    queryKey: ['shopify-products-catalog', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { searchTerm: '' }
      });
      if (error) throw error;
      return data as { products: ShopifyProduct[] };
    },
    enabled: !!currentOrganization?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch connected products from database
  const { data: connections } = useQuery({
    queryKey: ['ai-catalog-connections', currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_catalog_connections')
        .select('*')
        .eq('organization_id', currentOrganization!.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id,
  });

  const connectedProductIds = useMemo(() => {
    return new Set(connections?.filter(c => c.connected).map(c => c.shopify_product_id) || []);
  }, [connections]);

  const products = shopifyData?.products || [];

  // Calculate total stock per product
  const getProductStock = (product: ShopifyProduct) => {
    return product.variants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
  };

  // Apply filters
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Text search
      const matchesSearch = 
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.variants.some(v => v.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Status filter
      const matchesStatus = 
        statusFilter === 'all' || product.status === statusFilter;
      
      // Stock filter
      const totalStock = getProductStock(product);
      const matchesStock = 
        stockFilter === 'all' ||
        (stockFilter === 'in-stock' && totalStock > 0) ||
        (stockFilter === 'out-of-stock' && totalStock === 0);
      
      return matchesSearch && matchesStatus && matchesStock;
    });
  }, [products, searchTerm, statusFilter, stockFilter]);

  // Mutation to toggle product connection
  const toggleMutation = useMutation({
    mutationFn: async ({ productId, connected }: { productId: number; connected: boolean }) => {
      const { error } = await supabase
        .from('ai_catalog_connections')
        .upsert({
          organization_id: currentOrganization!.id,
          shopify_product_id: productId,
          connected,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,shopify_product_id'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-catalog-connections'] });
    },
    onError: (error) => {
      console.error('Error toggling product:', error);
      toast.error('Error al actualizar conexión');
    }
  });

  // Mutation to connect/disconnect all
  const bulkMutation = useMutation({
    mutationFn: async ({ connect }: { connect: boolean }) => {
      const upserts = products.map(p => ({
        organization_id: currentOrganization!.id,
        shopify_product_id: p.id,
        connected: connect,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('ai_catalog_connections')
        .upsert(upserts, {
          onConflict: 'organization_id,shopify_product_id'
        });
      if (error) throw error;
    },
    onSuccess: (_, { connect }) => {
      queryClient.invalidateQueries({ queryKey: ['ai-catalog-connections'] });
      toast.success(connect ? 'Todos los productos conectados' : 'Todos los productos desconectados');
    },
    onError: (error) => {
      console.error('Error in bulk operation:', error);
      toast.error('Error al actualizar productos');
    }
  });

  const handleToggleProduct = (productId: number) => {
    const isConnected = connectedProductIds.has(productId);
    toggleMutation.mutate({ productId, connected: !isConnected });
  };

  const handleConnectAll = () => {
    bulkMutation.mutate({ connect: true });
  };

  const handleDisconnectAll = () => {
    bulkMutation.mutate({ connect: false });
  };

  const handleSync = async () => {
    await refetch();
    toast.success('Catálogo sincronizado con Shopify');
  };

  // Stats
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const connectedCount = connectedProductIds.size;
    const activeProducts = products.filter(p => p.status === 'active').length;
    const inStockProducts = products.filter(p => getProductStock(p) > 0).length;
    const categories = new Set(products.map(p => p.product_type).filter(Boolean));
    
    return {
      totalProducts,
      connectedCount,
      activeProducts,
      inStockProducts,
      categoriesCount: categories.size
    };
  }, [products, connectedProductIds]);

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.totalProducts}</p>
              <p className="text-sm text-blue-600">Productos totales</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.connectedCount}</p>
              <p className="text-sm text-green-600">Conectados a IA</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 text-center">
              <p className="text-2xl font-bold text-purple-600">{stats.activeProducts}</p>
              <p className="text-sm text-purple-600">Activos</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.inStockProducts}</p>
              <p className="text-sm text-emerald-600">Con stock</p>
            </div>
            <div className="p-4 rounded-lg bg-orange-50 text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.categoriesCount}</p>
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
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleConnectAll}
                disabled={bulkMutation.isPending}
              >
                Conectar todos
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDisconnectAll}
                disabled={bulkMutation.isPending}
              >
                Desconectar todos
              </Button>
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-7">
                    Todos ({products.length})
                  </TabsTrigger>
                  <TabsTrigger value="active" className="text-xs px-3 h-7">
                    Activos ({products.filter(p => p.status === 'active').length})
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs px-3 h-7">
                    Borrador ({products.filter(p => p.status === 'draft').length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stock:</span>
              <Tabs value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-3 h-7">
                    Todos
                  </TabsTrigger>
                  <TabsTrigger value="in-stock" className="text-xs px-3 h-7">
                    Con stock ({products.filter(p => getProductStock(p) > 0).length})
                  </TabsTrigger>
                  <TabsTrigger value="out-of-stock" className="text-xs px-3 h-7">
                    Sin stock ({products.filter(p => getProductStock(p) === 0).length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Cargando productos de Shopify...</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredProducts.map((product) => {
                  const totalStock = getProductStock(product);
                  const isConnected = connectedProductIds.has(product.id);
                  const hasStock = totalStock > 0;
                  
                  return (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {product.image?.src ? (
                          <img
                            src={product.image.src}
                            alt={product.title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">
                            {product.title}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>SKU: {product.variants[0]?.sku || 'N/A'}</span>
                            <span>•</span>
                            <span className={hasStock ? 'text-emerald-600' : 'text-red-500'}>
                              {hasStock ? `${totalStock} en stock` : 'Sin stock'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {!hasStock && (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <Badge 
                          variant={product.status === 'active' ? 'default' : 'secondary'}
                          className={product.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          {product.status === 'active' ? 'Activo' : 'Borrador'}
                        </Badge>
                        <Switch
                          checked={isConnected}
                          onCheckedChange={() => handleToggleProduct(product.id)}
                          disabled={toggleMutation.isPending}
                        />
                      </div>
                    </div>
                  );
                })}

                {filteredProducts.length === 0 && (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 mx-auto text-muted-foreground opacity-50" />
                    <p className="mt-2 text-sm text-muted-foreground">No se encontraron productos</p>
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
          <Button 
            onClick={handleSync} 
            variant="outline" 
            className="w-full flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar ahora
          </Button>

          <div className="p-4 rounded-lg bg-muted space-y-3">
            <h4 className="font-medium text-sm">Información disponible para IA:</h4>
            <ul className="text-sm space-y-2 text-muted-foreground">
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
                Disponibilidad (stock real)
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

          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Inventario actualizado</span>
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              Los datos de productos se sincronizan con Shopify en tiempo real.
            </p>
          </div>

          <div className="pt-4 border-t border-border">
            <Button variant="link" className="p-0 h-auto flex items-center gap-1 text-sm">
              <ExternalLink className="h-3 w-3" />
              Ver documentación
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
