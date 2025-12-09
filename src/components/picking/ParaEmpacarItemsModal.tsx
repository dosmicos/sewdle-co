import React, { useEffect } from 'react';
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

interface ParaEmpacarItemsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderClick?: (shopifyOrderId: number) => void;
}

const ItemImage: React.FC<{ item: ParaEmpacarItem }> = ({ item }) => {
  if (!item.imageUrl) {
    return (
      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-5 h-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <img
      src={item.imageUrl}
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
  const { items, loading, error, fetchItems, totalQuantity, uniqueOrders } = useParaEmpacarItems();

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, fetchItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Artículos Para Empacar
          </DialogTitle>
          {!loading && !error && items.length > 0 && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
              <span>
                <strong className="text-foreground">{totalQuantity}</strong> unidades
              </span>
              <span>
                <strong className="text-foreground">{items.length}</strong> artículos únicos
              </span>
              <span>
                <strong className="text-foreground">{uniqueOrders}</strong> pedidos
              </span>
            </div>
          )}
        </DialogHeader>

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
                  <ItemImage item={item} />
                  
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
