import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Search, Package, Plus, Minus, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import BarcodeLabel from '@/components/delivery/BarcodeLabel';
import { Badge } from '@/components/ui/badge';

interface SelectedVariant {
  sku: string;
  productName: string;
  variant: string;
  quantity: number;
}

interface ProductBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProductBarcodeModal: React.FC<ProductBarcodeModalProps> = ({ isOpen, onClose }) => {
  const { products, loading, fetchProductVariants } = useProducts(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<unknown>(null);
  const [variants, setVariants] = useState<unknown[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products.slice(0, 20);
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [products, searchTerm]);

  const handleSelectProduct = async (product: unknown) => {
    setSelectedProduct(product);
    setLoadingVariants(true);
    try {
      const fetchedVariants = await fetchProductVariants(product.id);
      setVariants(fetchedVariants);
    } catch (error) {
      console.error('Error fetching variants:', error);
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleAddVariant = (variant: unknown, quantity: number) => {
    if (quantity <= 0) return;
    
    const variantText = [variant.size, variant.color].filter(Boolean).join(' - ');
    const existing = selectedVariants.find(v => v.sku === variant.sku_variant);
    
    if (existing) {
      setSelectedVariants(prev => 
        prev.map(v => v.sku === variant.sku_variant 
          ? { ...v, quantity: v.quantity + quantity }
          : v
        )
      );
    } else {
      setSelectedVariants(prev => [...prev, {
        sku: variant.sku_variant,
        productName: selectedProduct?.name || 'Producto',
        variant: variantText,
        quantity
      }]);
    }
  };

  const handleRemoveVariant = (sku: string) => {
    setSelectedVariants(prev => prev.filter(v => v.sku !== sku));
  };

  const handleUpdateQuantity = (sku: string, delta: number) => {
    setSelectedVariants(prev => 
      prev.map(v => {
        if (v.sku === sku) {
          const newQty = Math.max(1, v.quantity + delta);
          return { ...v, quantity: newQty };
        }
        return v;
      })
    );
  };

  // Generate all labels based on selected variants and quantities
  const labels = useMemo(() => {
    const result: Array<{
      sku: string;
      productName: string;
      variant: string;
      unitIndex: number;
    }> = [];

    selectedVariants.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        result.push({
          sku: item.sku,
          productName: item.productName,
          variant: item.variant,
          unitIndex: i + 1
        });
      }
    });

    return result;
  }, [selectedVariants]);

  const totalLabels = labels.length;
  const uniqueProducts = selectedVariants.length;

  const handlePrint = () => {
    if (labels.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;

    const labelsWithCompactText = labels.map(label => ({
      ...label,
      compactText: label.variant ? `${label.productName} - ${label.variant}` : label.productName
    }));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title></title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
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
          .barcode-label {
            width: 48mm;
            height: 20mm;
            padding: 1mm;
            box-sizing: border-box;
            text-align: center;
            page-break-inside: avoid;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          .barcode-label svg {
            max-width: 46mm;
            height: auto;
          }
          .product-info {
            font-size: 12px;
            font-weight: 500;
            margin-top: 1px;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 46mm;
            color: #333;
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
            .page {
              column-gap: 4mm;
              row-gap: 0;
              justify-content: center;
            }
            .barcode-label { 
              border: none;
              width: 48mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${labelsWithCompactText.map(label => `
            <div class="barcode-label">
              <svg id="barcode-${label.sku.replace(/[^a-zA-Z0-9]/g, '')}-${label.unitIndex}"></svg>
              <div class="product-info">${label.compactText}</div>
            </div>
          `).join('')}
        </div>
        <script>
          ${labelsWithCompactText.map(label => `
            JsBarcode("#barcode-${label.sku.replace(/[^a-zA-Z0-9]/g, '')}-${label.unitIndex}", "${label.sku}", {
              format: "CODE128",
              width: 2.5,
              height: 70,
              fontSize: 16,
              margin: 0,
              displayValue: true,
              textMargin: 2
            });
          `).join('')}
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedProduct(null);
    setVariants([]);
    setSelectedVariants([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Imprimir Códigos de Barras de Productos
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Left Panel - Product Search & Selection */}
          <div className="w-1/2 flex flex-col border rounded-lg p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="flex-1 h-[200px]">
              <div className="space-y-1">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Cargando productos...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No se encontraron productos</div>
                ) : (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedProduct?.id === product.id 
                          ? 'bg-primary/10 border border-primary' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="font-medium text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku}</div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Variants Section */}
            {selectedProduct && (
              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">
                  Variantes de {selectedProduct.name}
                </Label>
                <ScrollArea className="h-[180px]">
                  {loadingVariants ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">Cargando variantes...</div>
                  ) : variants.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">Sin variantes</div>
                  ) : (
                    <div className="space-y-2">
                      {variants.map(variant => (
                        <VariantRow 
                          key={variant.id} 
                          variant={variant} 
                          productName={selectedProduct.name}
                          onAdd={(qty) => handleAddVariant(variant, qty)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Right Panel - Selected Items & Preview */}
          <div className="w-1/2 flex flex-col border rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Etiquetas a Imprimir</Label>
              {selectedVariants.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedVariants([])}
                  className="text-xs h-7"
                >
                  Limpiar todo
                </Button>
              )}
            </div>

            {/* Selected variants list */}
            <ScrollArea className="flex-1 h-[150px]">
              {selectedVariants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Selecciona productos y variantes para agregar etiquetas
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedVariants.map(item => (
                    <div key={item.sku} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {item.productName} {item.variant && `- ${item.variant}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.sku}</div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => handleUpdateQuantity(item.sku, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => handleUpdateQuantity(item.sku, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleRemoveVariant(item.sku)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Preview */}
            {labels.length > 0 && (
              <div className="border-t pt-3">
                <Label className="text-sm font-medium mb-2 block">Vista Previa</Label>
                <ScrollArea className="h-[120px]">
                  <div className="grid grid-cols-2 gap-2">
                    {labels.slice(0, 6).map((label, index) => (
                      <BarcodeLabel
                        key={`${label.sku}-${index}`}
                        sku={label.sku}
                        productName={label.productName}
                        variant={label.variant}
                        index={index}
                      />
                    ))}
                  </div>
                  {labels.length > 6 && (
                    <div className="text-center text-sm text-muted-foreground mt-2">
                      +{labels.length - 6} etiquetas más...
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex gap-4 text-sm">
            <span><strong>{totalLabels}</strong> etiquetas</span>
            <span><strong>{uniqueProducts}</strong> variantes</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button onClick={handlePrint} disabled={labels.length === 0} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir Etiquetas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Sub-component for variant row with quantity input
const VariantRow: React.FC<{
  variant: unknown;
  productName: string;
  onAdd: (quantity: number) => void;
}> = ({ variant, productName, onAdd }) => {
  const [qty, setQty] = useState(0);
  
  const variantText = [variant.size, variant.color].filter(Boolean).join(' - ');
  
  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
      <div className="flex-1 min-w-0">
        <div className="truncate font-medium">{variantText || 'Sin variante'}</div>
        <div className="text-xs text-muted-foreground">{variant.sku_variant}</div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(Math.max(0, parseInt(e.target.value) || 0))}
          className="w-16 h-7 text-center"
        />
        <Button 
          size="sm" 
          variant="secondary"
          className="h-7"
          onClick={() => onAdd(qty)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Agregar
        </Button>
      </div>
    </div>
  );
};

export default ProductBarcodeModal;
