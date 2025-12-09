import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Package, Hash, ImageOff, Sparkles, ChevronDown, X, FilterX } from 'lucide-react';
import { useParaEmpacarItems, ParaEmpacarItem } from '@/hooks/useParaEmpacarItems';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ParaEmpacarItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderClick?: (shopifyOrderId: number) => void;
}

// Componente LazyImage con Intersection Observer
const LazyImage: React.FC<{ item: ParaEmpacarItem }> = ({ item }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl);
  const [loading, setLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (imageUrl || hasAttempted) return;
    if (!item.productId || !item.variantId) {
      setHasAttempted(true);
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !hasAttempted) {
          setHasAttempted(true);
          setLoading(true);
          
          try {
            const { data, error } = await supabase.functions.invoke('get-shopify-variant-image', {
              body: { product_id: item.productId, variant_id: item.variantId }
            });
            
            if (!error && data?.image_url) {
              setImageUrl(data.image_url);
            }
          } catch (err) {
            console.error('Error loading image:', err);
          } finally {
            setLoading(false);
          }
        }
      },
      { rootMargin: '200px', threshold: 0.1 }
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [item.productId, item.variantId, imageUrl, hasAttempted]);

  useEffect(() => {
    setImageUrl(item.imageUrl);
    setHasAttempted(!!item.imageUrl);
    setLoading(false);
  }, [item.id, item.imageUrl]);

  if (loading) {
    return (
      <div ref={imgRef} className="w-14 h-14 rounded-md flex-shrink-0">
        <Skeleton className="w-full h-full rounded-md" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div ref={imgRef} className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      ref={imgRef as any}
      src={imageUrl}
      alt={item.title}
      className="w-14 h-14 rounded-md object-cover flex-shrink-0"
    />
  );
};

export const ParaEmpacarItemsModal: React.FC<ParaEmpacarItemsModalProps> = ({
  open,
  onOpenChange,
  onOrderClick,
}) => {
  const { 
    items, 
    allItems,
    loading, 
    error, 
    fetchItems, 
    totalQuantity, 
    uniqueOrders,
    availableSizes,
    selectedSizes,
    setSelectedSizes,
    showOnlyEmbroidery,
    setShowOnlyEmbroidery,
    clearAllFilters,
    hasActiveFilters,
  } = useParaEmpacarItems();

  const [sizePopoverOpen, setSizePopoverOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, fetchItems]);

  const removeSize = (size: string) => {
    setSelectedSizes(selectedSizes.filter(s => s !== size));
  };

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      removeSize(size);
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Artículos Para Empacar
          </DialogTitle>
          {!loading && !error && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-1">
              <span>
                <strong className="text-foreground">{totalQuantity}</strong> unidades
              </span>
              <span>
                <strong className="text-foreground">{items.length}</strong> artículos
              </span>
              <span>
                <strong className="text-foreground">{uniqueOrders}</strong> pedidos
              </span>
            </div>
          )}
        </DialogHeader>

        {/* Filtros compactos - siempre visibles si hay datos */}
        {!loading && !error && allItems.length > 0 && (
          <div className="px-6 py-2 border-y bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dropdown de tallas */}
              <Popover open={sizePopoverOpen} onOpenChange={setSizePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "h-7 text-xs gap-1",
                      selectedSizes.length > 0 && "border-primary text-primary"
                    )}
                  >
                    Talla
                    {selectedSizes.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {selectedSizes.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex flex-wrap gap-1 max-w-[280px]">
                    {availableSizes.map(size => (
                      <button
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={cn(
                          "px-2 py-1 text-xs rounded border transition-colors",
                          selectedSizes.includes(size)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Toggle bordados como chip */}
              <button
                onClick={() => setShowOnlyEmbroidery(!showOnlyEmbroidery)}
                className={cn(
                  "h-7 px-2.5 text-xs rounded-md border transition-colors flex items-center gap-1.5",
                  showOnlyEmbroidery
                    ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                )}
              >
                <Sparkles className="w-3 h-3" />
                Bordados
              </button>

              {/* Separador + limpiar */}
              {hasActiveFilters && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  <button
                    onClick={clearAllFilters}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <FilterX className="w-3 h-3" />
                    Limpiar
                  </button>
                </>
              )}
            </div>

            {/* Chips de filtros activos */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {selectedSizes.map(size => (
                  <Badge 
                    key={size} 
                    variant="secondary" 
                    className="h-5 text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
                    onClick={() => removeSize(size)}
                  >
                    {size}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
                {showOnlyEmbroidery && (
                  <Badge 
                    variant="secondary" 
                    className="h-5 text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                    onClick={() => setShowOnlyEmbroidery(false)}
                  >
                    <Sparkles className="w-3 h-3" />
                    Bordados
                    <X className="w-3 h-3" />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}

        <ScrollArea className="flex-1 px-6">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-3 border rounded-lg">
                  <Skeleton className="w-14 h-14 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center">
              {hasActiveFilters ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground">No hay artículos con estos filtros</p>
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <FilterX className="w-4 h-4 mr-1" />
                    Quitar filtros
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">No hay artículos para empacar</p>
              )}
            </div>
          ) : (
            <div className="space-y-2 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <LazyImage item={item} />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.title}</p>
                        {item.variantTitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.variantTitle}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-base font-bold">
                        x{item.quantity}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.sku && (
                        <span className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </span>
                      )}
                    </div>

                    {/* Números de pedido */}
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {item.orderNumbers.slice(0, 8).map((orderNum, idx) => (
                        <button
                          key={`${orderNum}-${idx}`}
                          onClick={() => onOrderClick?.(item.shopifyOrderIds[idx])}
                          className="flex items-center gap-0.5 text-xs text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded"
                        >
                          <Hash className="w-3 h-3" />
                          {orderNum}
                        </button>
                      ))}
                      {item.orderNumbers.length > 8 && (
                        <span className="text-xs text-muted-foreground">
                          +{item.orderNumbers.length - 8} más
                        </span>
                      )}
                    </div>

                    {/* Propiedades de personalización (bordado) */}
                    {item.hasCustomization && item.properties && item.properties.length > 0 && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs space-y-0.5">
                        {item.properties.map((prop, idx) => (
                          <p key={idx} className="text-amber-800">
                            <strong>{prop.name}:</strong> {prop.value}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
