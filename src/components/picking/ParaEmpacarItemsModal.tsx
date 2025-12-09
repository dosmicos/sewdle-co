import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Hash, ImageOff } from 'lucide-react';
import { useParaEmpacarItems, ParaEmpacarItem } from '@/hooks/useParaEmpacarItems';
import { supabase } from '@/integrations/supabase/client';

interface ParaEmpacarItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderClick?: (shopifyOrderId: number) => void;
}

// Image component that receives URL from parent's throttled fetcher
const ItemImage: React.FC<{ item: ParaEmpacarItem; imageUrl: string | null; loading: boolean }> = ({ 
  item, 
  imageUrl,
  loading 
}) => {
  if (loading) {
    return <Skeleton className="w-14 h-14 rounded-md" />;
  }

  if (!imageUrl) {
    return (
      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center">
        <ImageOff className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={item.title}
      className="w-14 h-14 rounded-md object-cover"
    />
  );
};

export const ParaEmpacarItemsModal: React.FC<ParaEmpacarItemsModalProps> = ({
  open,
  onOpenChange,
  onOrderClick,
}) => {
  const { items, loading, error, fetchItems, totalQuantity, uniqueOrders } = useParaEmpacarItems();
  const [imageUrls, setImageUrls] = useState<Record<string, string | null>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const fetchQueueRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      fetchItems();
      setImageUrls({});
      setLoadingImages(new Set());
    } else {
      // Cancel any pending image fetches when modal closes
      if (fetchQueueRef.current) {
        fetchQueueRef.current.abort();
        fetchQueueRef.current = null;
      }
    }
  }, [open, fetchItems]);

  // Throttled image fetching - process one at a time with 600ms delay (max ~1.6 calls/sec, under 2/sec limit)
  const fetchImagesThrottled = useCallback(async (itemsToFetch: ParaEmpacarItem[]) => {
    const controller = new AbortController();
    fetchQueueRef.current = controller;

    const itemsNeedingFetch = itemsToFetch.filter(
      item => !item.imageUrl && item.productId && !imageUrls[item.id]
    );

    // Mark all as loading
    setLoadingImages(new Set(itemsNeedingFetch.map(i => i.id)));

    for (const item of itemsNeedingFetch) {
      if (controller.signal.aborted) break;

      try {
        const { data } = await supabase.functions.invoke('get-shopify-variant-image', {
          body: { product_id: item.productId, variant_id: item.variantId }
        });

        if (!controller.signal.aborted) {
          setImageUrls(prev => ({
            ...prev,
            [item.id]: data?.image_url || null
          }));
          setLoadingImages(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error fetching image:', err);
          setLoadingImages(prev => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      }

      // Wait 600ms before next request to stay under rate limit
      if (!controller.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
  }, [imageUrls]);

  // Start fetching images when items are loaded
  useEffect(() => {
    if (items.length > 0 && open) {
      fetchImagesThrottled(items);
    }
  }, [items, open, fetchImagesThrottled]);

  const getImageUrl = (item: ParaEmpacarItem) => {
    if (item.imageUrl) return item.imageUrl;
    return imageUrls[item.id] || null;
  };

  const isImageLoading = (item: ParaEmpacarItem) => {
    if (item.imageUrl) return false;
    return loadingImages.has(item.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Artículos Para Empacar
          </DialogTitle>
        </DialogHeader>

        {!loading && !error && items.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground pb-2 border-b">
            <span>
              <strong className="text-foreground">{totalQuantity}</strong> artículos
            </span>
            <span>
              <strong className="text-foreground">{uniqueOrders}</strong> pedidos
            </span>
          </div>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
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
            <div className="py-8 text-center text-muted-foreground">
              No hay artículos para empacar
            </div>
          ) : (
            <div className="space-y-2 py-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <ItemImage 
                    item={item} 
                    imageUrl={getImageUrl(item)} 
                    loading={isImageLoading(item)} 
                  />
                  
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
                      <Badge variant="secondary" className="shrink-0">
                        x{item.quantity}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {item.sku && (
                        <span className="text-xs text-muted-foreground">
                          SKU: {item.sku}
                        </span>
                      )}
                      <button
                        onClick={() => onOrderClick?.(item.shopifyOrderId)}
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Hash className="w-3 h-3" />
                        {item.orderNumber}
                      </button>
                    </div>

                    {item.properties && item.properties.length > 0 && (
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
