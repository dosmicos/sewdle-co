import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, Check, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface MissingProduct {
  name: string;
  sku: string | null;
  priceWithTax: number;
  priceWithoutTax: number;
  selected: boolean;
}

interface AlegraProductSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

interface AlegraItem {
  id: string;
  name: string;
  reference: string | null;
}

const AlegraProductSyncModal = ({ open, onOpenChange, onSyncComplete }: AlegraProductSyncModalProps) => {
  const { currentOrganization } = useOrganization();
  const [step, setStep] = useState<'detecting' | 'review' | 'syncing' | 'complete'>('detecting');
  const [shopifyProductsCount, setShopifyProductsCount] = useState(0);
  const [alegraItemsCount, setAlegraItemsCount] = useState(0);
  const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncResults, setSyncResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Fuzzy matching function to compare product names
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;
    
    const words1 = s1.split(/\s+/).filter(w => w.length > 2);
    const words2 = s2.split(/\s+/).filter(w => w.length > 2);
    
    let matches = 0;
    for (const word of words1) {
      if (words2.some(w => w.includes(word) || word.includes(w))) {
        matches++;
      }
    }
    
    return words1.length > 0 ? matches / words1.length : 0;
  };

  const findBestMatch = (productName: string, alegraItems: AlegraItem[]): { item: AlegraItem; score: number } | null => {
    let bestMatch: { item: AlegraItem; score: number } | null = null;
    
    for (const item of alegraItems) {
      const score = calculateSimilarity(productName, item.name);
      if (score > 0.6 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { item, score };
      }
    }
    
    return bestMatch;
  };

  const loadAllAlegraItems = async (): Promise<AlegraItem[]> => {
    const allItems: AlegraItem[] = [];
    const pageSize = 30;
    let page = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase.functions.invoke('alegra-api', {
        body: { 
          action: 'get-items',
          data: { start: page * pageSize, limit: pageSize }
        }
      });
      
      if (error || !data?.success || !Array.isArray(data.data)) {
        break;
      }
      
      const items = data.data.filter((item: any) => item.status === 'active');
      allItems.push(...items);
      
      hasMore = items.length === pageSize;
      page++;
      
      // Safety limit
      if (page > 50) break;
    }
    
    return allItems;
  };

  const detectMissingProducts = async () => {
    if (!currentOrganization?.id) return;
    
    setIsLoading(true);
    setStep('detecting');
    
    try {
      // 1. Get unique products from Shopify order line items (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: shopifyProducts, error: shopifyError } = await supabase
        .from('shopify_order_line_items')
        .select('title, variant_title, sku, price')
        .eq('organization_id', currentOrganization.id)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('title');
      
      if (shopifyError) throw shopifyError;
      
      // 2. Deduplicate by title + variant
      const uniqueProducts = new Map<string, { title: string; variant_title: string | null; sku: string | null; price: number }>();
      for (const p of shopifyProducts || []) {
        const key = `${p.title}|${p.variant_title || ''}`;
        if (!uniqueProducts.has(key)) {
          uniqueProducts.set(key, p);
        }
      }
      
      setShopifyProductsCount(uniqueProducts.size);
      
      // 3. Load all Alegra items
      const alegraItems = await loadAllAlegraItems();
      setAlegraItemsCount(alegraItems.length);
      
      // 4. Find products that don't exist in Alegra
      const missing: MissingProduct[] = [];
      
      for (const [, product] of uniqueProducts) {
        const fullName = product.variant_title 
          ? `${product.title} ${product.variant_title}` 
          : product.title;
        
        const match = findBestMatch(fullName, alegraItems);
        
        if (!match) {
          const priceWithTax = parseFloat(String(product.price)) || 0;
          missing.push({
            name: fullName,
            sku: product.sku,
            priceWithTax,
            priceWithoutTax: Math.round(priceWithTax / 1.19),
            selected: true
          });
        }
      }
      
      // Sort by name
      missing.sort((a, b) => a.name.localeCompare(b.name));
      
      setMissingProducts(missing);
      setStep('review');
      
      if (missing.length === 0) {
        toast.success('¡Todos los productos ya existen en Alegra!');
      }
    } catch (error: any) {
      console.error('Error detecting missing products:', error);
      toast.error('Error al detectar productos: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const syncProductsToAlegra = async () => {
    const selectedProducts = missingProducts.filter(p => p.selected);
    if (selectedProducts.length === 0) {
      toast.error('Selecciona al menos un producto');
      return;
    }
    
    setStep('syncing');
    setSyncProgress(0);
    setSyncResults({ success: 0, failed: 0 });
    
    try {
      // Prepare items for bulk creation
      const itemsToCreate = selectedProducts.map(p => ({
        name: p.name,
        reference: p.sku || undefined,
        price: p.priceWithoutTax,
        description: 'Sincronizado desde Shopify'
      }));
      
      // Create in batches of 10 to show progress
      const batchSize = 10;
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < itemsToCreate.length; i += batchSize) {
        const batch = itemsToCreate.slice(i, i + batchSize);
        
        const { data, error } = await supabase.functions.invoke('alegra-api', {
          body: { 
            action: 'create-items-bulk',
            data: { items: batch }
          }
        });
        
        if (error) throw error;
        
        if (data?.success && Array.isArray(data.data)) {
          const batchResults = data.data as Array<{ success: boolean }>;
          successCount += batchResults.filter(r => r.success).length;
          failedCount += batchResults.filter(r => !r.success).length;
        }
        
        const progress = Math.min(100, Math.round(((i + batch.length) / itemsToCreate.length) * 100));
        setSyncProgress(progress);
        setSyncResults({ success: successCount, failed: failedCount });
      }
      
      setStep('complete');
      
      if (failedCount === 0) {
        toast.success(`¡${successCount} productos creados exitosamente!`);
      } else {
        toast.warning(`${successCount} productos creados, ${failedCount} fallaron`);
      }
      
      onSyncComplete();
    } catch (error: any) {
      console.error('Error syncing products:', error);
      toast.error('Error al sincronizar: ' + error.message);
      setStep('review');
    }
  };

  const toggleProduct = (index: number) => {
    setMissingProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, selected: !p.selected } : p
    ));
  };

  const toggleAllProducts = (selected: boolean) => {
    setMissingProducts(prev => prev.map(p => ({ ...p, selected })));
  };

  const selectedCount = missingProducts.filter(p => p.selected).length;

  // Start detection when modal opens
  React.useEffect(() => {
    if (open) {
      detectMissingProducts();
    } else {
      // Reset state when closing
      setStep('detecting');
      setMissingProducts([]);
      setSyncProgress(0);
      setSyncResults({ success: 0, failed: 0 });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sincronizar Productos a Alegra
          </DialogTitle>
          <DialogDescription>
            Detecta productos de Shopify que no existen en Alegra y créalos automáticamente.
          </DialogDescription>
        </DialogHeader>

        {step === 'detecting' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analizando catálogos...</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{shopifyProductsCount}</div>
                <div className="text-xs text-muted-foreground">En Shopify</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">{alegraItemsCount}</div>
                <div className="text-xs text-muted-foreground">En Alegra</div>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary">{missingProducts.length}</div>
                <div className="text-xs text-muted-foreground">Faltantes</div>
              </div>
            </div>

            {missingProducts.length > 0 ? (
              <>
                {/* Select all toggle */}
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm font-medium">Productos a crear:</span>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleAllProducts(true)}
                    >
                      Todos
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleAllProducts(false)}
                    >
                      Ninguno
                    </Button>
                  </div>
                </div>

                {/* Products list */}
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {missingProducts.map((product, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleProduct(index)}
                      >
                        <Checkbox 
                          checked={product.selected}
                          onCheckedChange={() => toggleProduct(index)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          {product.sku && (
                            <Badge variant="outline" className="text-xs mt-1">
                              SKU: {product.sku}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">
                            ${product.priceWithoutTax.toLocaleString('es-CO')}
                          </div>
                          <div className="text-xs text-muted-foreground">+ IVA</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Check className="h-12 w-12 text-primary" />
                <p className="font-medium">¡Todo sincronizado!</p>
                <p className="text-sm text-muted-foreground">
                  Todos los productos de Shopify ya existen en el catálogo de Alegra.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'syncing' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 animate-pulse text-primary" />
              <span className="font-medium">Creando productos en Alegra...</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{syncProgress}% completado</span>
              <span>
                {syncResults.success} creados
                {syncResults.failed > 0 && <span className="text-destructive"> / {syncResults.failed} fallidos</span>}
              </span>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            {syncResults.failed === 0 ? (
              <Check className="h-12 w-12 text-primary" />
            ) : (
              <AlertCircle className="h-12 w-12 text-destructive" />
            )}
            <div className="text-center">
              <p className="font-medium text-lg">
                {syncResults.success} productos creados
              </p>
              {syncResults.failed > 0 && (
                <p className="text-sm text-muted-foreground">
                  {syncResults.failed} productos no se pudieron crear
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'review' && missingProducts.length > 0 && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={syncProductsToAlegra}
                disabled={selectedCount === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Crear {selectedCount} Producto{selectedCount !== 1 ? 's' : ''} en Alegra
              </Button>
            </>
          )}
          {(step === 'review' && missingProducts.length === 0) || step === 'complete' ? (
            <Button onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AlegraProductSyncModal;
