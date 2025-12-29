import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Link2, Unlink, RefreshCw, Package, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AlegraItem {
  id: string;
  name: string;
  reference: string | null;
  price: { price: number; currency: { code: string } }[];
  status: string;
  category?: { name: string };
}

interface ProductMapping {
  id: string;
  shopify_product_title: string;
  shopify_variant_title: string | null;
  shopify_sku: string | null;
  alegra_item_id: string;
  alegra_item_name: string | null;
}

interface ShopifyProduct {
  title: string;
  variant_title: string | null;
  sku: string | null;
}

const AlegraProductMapper = () => {
  const { currentOrganization } = useOrganization();
  const [alegraItems, setAlegraItems] = useState<AlegraItem[]>([]);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMappings, setIsLoadingMappings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mapping dialog state
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [selectedAlegraItem, setSelectedAlegraItem] = useState<AlegraItem | null>(null);
  const [shopifyProductTitle, setShopifyProductTitle] = useState('');
  const [shopifyVariantTitle, setShopifyVariantTitle] = useState('');
  const [shopifySku, setShopifySku] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchAlegraItems = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('alegra-api', {
        body: { 
          action: 'get-items',
          data: { limit: 100, search: searchTerm || undefined }
        }
      });

      if (error) throw error;
      
      if (data?.success && Array.isArray(data.data)) {
        setAlegraItems(data.data.filter((item: AlegraItem) => item.status === 'active'));
      } else {
        throw new Error(data?.error || 'Error al cargar productos');
      }
    } catch (error: any) {
      console.error('Error fetching Alegra items:', error);
      toast.error('Error al cargar productos de Alegra: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMappings = async () => {
    if (!currentOrganization?.id) return;
    
    setIsLoadingMappings(true);
    try {
      const { data, error } = await supabase
        .from('alegra_product_mapping')
        .select('*')
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;
      setMappings(data || []);
    } catch (error: any) {
      console.error('Error fetching mappings:', error);
      toast.error('Error al cargar mapeos: ' + error.message);
    } finally {
      setIsLoadingMappings(false);
    }
  };

  useEffect(() => {
    fetchAlegraItems();
    fetchMappings();
  }, [currentOrganization?.id]);

  const handleSearch = () => {
    fetchAlegraItems();
  };

  const openMappingDialog = (item: AlegraItem) => {
    setSelectedAlegraItem(item);
    setShopifyProductTitle('');
    setShopifyVariantTitle('');
    setShopifySku('');
    setMappingDialogOpen(true);
  };

  const saveMapping = async () => {
    if (!selectedAlegraItem || !shopifyProductTitle.trim() || !currentOrganization?.id) {
      toast.error('El título del producto de Shopify es requerido');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('alegra_product_mapping')
        .upsert({
          organization_id: currentOrganization.id,
          shopify_product_title: shopifyProductTitle.trim(),
          shopify_variant_title: shopifyVariantTitle.trim() || null,
          shopify_sku: shopifySku.trim() || null,
          alegra_item_id: selectedAlegraItem.id,
          alegra_item_name: selectedAlegraItem.name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,shopify_product_title,shopify_variant_title'
        });

      if (error) throw error;

      toast.success('Mapeo guardado correctamente');
      setMappingDialogOpen(false);
      fetchMappings();
    } catch (error: any) {
      console.error('Error saving mapping:', error);
      toast.error('Error al guardar mapeo: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteMapping = async (mappingId: string) => {
    try {
      const { error } = await supabase
        .from('alegra_product_mapping')
        .delete()
        .eq('id', mappingId);

      if (error) throw error;

      toast.success('Mapeo eliminado');
      fetchMappings();
    } catch (error: any) {
      console.error('Error deleting mapping:', error);
      toast.error('Error al eliminar mapeo: ' + error.message);
    }
  };

  const getMappingForItem = (itemId: string) => {
    return mappings.filter(m => m.alegra_item_id === itemId);
  };

  const getPrice = (item: AlegraItem) => {
    const mainPrice = item.price?.find(p => p.currency?.code === 'COP');
    return mainPrice?.price ?? item.price?.[0]?.price ?? 0;
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm) return alegraItems;
    const term = searchTerm.toLowerCase();
    return alegraItems.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.reference?.toLowerCase().includes(term) ||
      item.id.includes(term)
    );
  }, [alegraItems, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Existing Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Mapeos Existentes ({mappings.length})
          </CardTitle>
          <CardDescription>
            Productos de Shopify vinculados al catálogo de Alegra
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingMappings ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay mapeos configurados. Busca productos de Alegra abajo y vincúlalos.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto Shopify</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>ID Alegra</TableHead>
                  <TableHead>Producto Alegra</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map(mapping => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">{mapping.shopify_product_title}</TableCell>
                    <TableCell>{mapping.shopify_variant_title || '-'}</TableCell>
                    <TableCell>
                      {mapping.shopify_sku ? (
                        <Badge variant="outline">{mapping.shopify_sku}</Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge>{mapping.alegra_item_id}</Badge>
                    </TableCell>
                    <TableCell>{mapping.alegra_item_name || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMapping(mapping.id)}
                      >
                        <Unlink className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alegra Catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de Alegra
          </CardTitle>
          <CardDescription>
            Busca productos en tu catálogo de Alegra para vincularlos a productos de Shopify
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, referencia o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={fetchAlegraItems} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No se encontraron productos. Intenta con otra búsqueda.
            </p>
          ) : (
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Vinculado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map(item => {
                    const itemMappings = getMappingForItem(item.id);
                    const isMapped = itemMappings.length > 0;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="secondary">{item.id}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          {item.reference || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          ${getPrice(item).toLocaleString('es-CO')}
                        </TableCell>
                        <TableCell>
                          {isMapped ? (
                            <div className="flex items-center gap-1">
                              <Check className="h-4 w-4 text-green-600" />
                              <span className="text-xs text-muted-foreground">
                                {itemMappings.length} mapeo(s)
                              </span>
                            </div>
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isMapped ? "outline" : "default"}
                            onClick={() => openMappingDialog(item)}
                          >
                            <Link2 className="h-4 w-4 mr-1" />
                            Vincular
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Producto de Shopify</DialogTitle>
            <DialogDescription>
              Ingresa los datos del producto de Shopify que corresponde a:
              <br />
              <strong>Alegra #{selectedAlegraItem?.id}: {selectedAlegraItem?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título del Producto (Shopify) *</label>
              <Input
                placeholder="Ej: Abrigo Simple Furry"
                value={shopifyProductTitle}
                onChange={(e) => setShopifyProductTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Debe coincidir exactamente con el título en Shopify
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Variante (opcional)</label>
              <Input
                placeholder="Ej: Talla 8 / Rosado"
                value={shopifyVariantTitle}
                onChange={(e) => setShopifyVariantTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Si el producto tiene variantes, especifícala. Deja vacío para todas las variantes.
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">SKU (opcional)</label>
              <Input
                placeholder="Ej: ASF-008-ROS"
                value={shopifySku}
                onChange={(e) => setShopifySku(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveMapping} disabled={isSaving || !shopifyProductTitle.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar Mapeo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlegraProductMapper;
