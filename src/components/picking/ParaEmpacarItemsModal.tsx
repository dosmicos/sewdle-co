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
import { Package, Hash, ImageOff, Sparkles, ChevronDown, X, FilterX, Printer, MapPin, RotateCcw } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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

// Descripciones de pasillos
const AISLE_DESCRIPTIONS: Record<number, string> = {
  1: 'Ruanas 2, 4, 6, 8',
  2: 'Ruanas 10, 12 + Sleeping',
  3: 'Adulto + Chaquetas + Otros',
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
    availableAisles,
    selectedAisles,
    setSelectedAisles,
    showOnlyEmbroidery,
    setShowOnlyEmbroidery,
    clearAllFilters,
    hasActiveFilters,
  } = useParaEmpacarItems();

  const [sizePopoverOpen, setSizePopoverOpen] = useState(false);
  const [aislePopoverOpen, setAislePopoverOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItemChecked = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const resetCheckedItems = () => {
    setCheckedItems(new Set());
  };

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, fetchItems]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Expand each item into individual label units (one per unit, paired with order numbers)
    const labelUnits: Array<{
      title: string;
      size: string;
      orderNumber: number;
      embroideryName: string | null;
      hasEmbroidery: boolean;
    }> = [];

    items.forEach(item => {
      const customizationNames = ['nombre bordado', 'para', 'nombre'];
      const embroideryProp = item.properties?.find(p =>
        customizationNames.includes(p.name.toLowerCase())
      );
      const embroideryName = embroideryProp?.value || null;
      const size = item.size || item.variantTitle || '';

      for (let i = 0; i < item.quantity; i++) {
        const orderNumber = item.orderNumbers[i % item.orderNumbers.length];
        labelUnits.push({
          title: item.title,
          size,
          orderNumber,
          embroideryName,
          hasEmbroidery: item.hasCustomization,
        });
      }
    });

    const labelsHtml = labelUnits.map(label => `
      <div class="label${label.hasEmbroidery ? ' label-embroidery' : ''}">
        <div class="product-name">${label.title}</div>
        ${label.size ? `<div class="size-info">${label.size}</div>` : ''}
        <div class="order-num">#${label.orderNumber}</div>
        ${label.hasEmbroidery && label.embroideryName
          ? `<div class="embroidery">&#129523; ${label.embroideryName}</div>`
          : ''}
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiquetas - Artículos Para Empacar</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100mm;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            display: grid;
            grid-template-columns: repeat(2, 48mm);
            column-gap: 4mm;
            row-gap: 0;
            padding: 0;
            margin: 0;
            justify-content: center;
          }
          .label {
            width: 48mm;
            height: 20mm;
            padding: 1.5mm 2mm;
            box-sizing: border-box;
            page-break-inside: avoid;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
          }
          .label-embroidery {
            background: #fffbeb;
            border-left: 1.5mm solid #f59e0b;
          }
          .product-name {
            font-size: 7.5pt;
            font-weight: 700;
            line-height: 1.15;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #111;
          }
          .size-info {
            font-size: 7pt;
            color: #444;
            line-height: 1.15;
            margin-top: 0.4mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .order-num {
            font-size: 8.5pt;
            font-weight: 700;
            color: #1d4ed8;
            line-height: 1.15;
            margin-top: 0.4mm;
          }
          .embroidery {
            font-size: 6.5pt;
            font-weight: 700;
            color: #92400e;
            background: #fef3c7;
            padding: 0.3mm 1mm;
            border-radius: 0.5mm;
            margin-top: 0.5mm;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          @media print {
            @page {
              size: 100mm 20mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            html, body {
              width: 100mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            .label {
              border: none;
              width: 48mm;
            }
            .label-embroidery {
              background: #fffbeb !important;
              border-left: 1.5mm solid #f59e0b !important;
            }
            .embroidery {
              background: #fef3c7 !important;
              color: #92400e !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${labelsHtml}
        </div>
        <script>
          setTimeout(function() { window.print(); window.close(); }, 300);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

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

  const removeAisle = (aisle: number) => {
    setSelectedAisles(selectedAisles.filter(a => a !== aisle));
  };

  const toggleAisle = (aisle: number) => {
    if (selectedAisles.includes(aisle)) {
      removeAisle(aisle);
    } else {
      setSelectedAisles([...selectedAisles, aisle]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Artículos Para Empacar
            </DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={loading || items.length === 0}
              className="h-7 text-xs gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
          </div>
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
              {checkedItems.size > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-green-600 dark:text-green-400">
                    <strong>{checkedItems.size}</strong>/{items.length} apartados
                  </span>
                </>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Filtros compactos - siempre visibles si hay datos o filtros activos */}
        {!loading && (allItems.length > 0 || hasActiveFilters) && (
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
                    disabled={availableSizes.length === 0}
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

              {/* Dropdown de pasillos */}
              <Popover open={aislePopoverOpen} onOpenChange={setAislePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "h-7 text-xs gap-1",
                      selectedAisles.length > 0 && "border-primary text-primary"
                    )}
                    disabled={availableAisles.length === 0}
                  >
                    <MapPin className="w-3 h-3" />
                    Pasillo
                    {selectedAisles.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                        {selectedAisles.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="flex flex-col gap-1.5">
                    {availableAisles.map(aisle => (
                      <button
                        key={aisle}
                        onClick={() => toggleAisle(aisle)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded border transition-colors text-left",
                          selectedAisles.includes(aisle)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        <span className="font-medium">Pasillo {aisle}</span>
                        <span className="text-[10px] block opacity-75">
                          {AISLE_DESCRIPTIONS[aisle]}
                        </span>
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

              {/* Separador + limpiar filtros */}
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

              {/* Reiniciar checkboxes */}
              {checkedItems.size > 0 && (
                <>
                  <div className="h-4 w-px bg-border mx-1" />
                  <button
                    onClick={resetCheckedItems}
                    className="h-7 px-2 text-xs text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reiniciar ({checkedItems.size})
                  </button>
                </>
              )}
            </div>

            {/* Chips de filtros activos */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {selectedAisles.map(aisle => (
                  <Badge 
                    key={`aisle-${aisle}`} 
                    variant="secondary" 
                    className="h-5 text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                    onClick={() => removeAisle(aisle)}
                  >
                    <MapPin className="w-3 h-3" />
                    Pasillo {aisle}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
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
                  className={cn(
                    "flex gap-3 p-3 border rounded-lg transition-colors",
                    checkedItems.has(item.id)
                      ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Checkbox para marcar artículo como apartado */}
                  <Checkbox
                    checked={checkedItems.has(item.id)}
                    onCheckedChange={() => toggleItemChecked(item.id)}
                    className="mt-4 h-5 w-5 shrink-0"
                  />
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
