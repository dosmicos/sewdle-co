import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Package } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import BarcodeLabel from './BarcodeLabel';

interface ApprovedItem {
  id: string;
  quantity_approved: number;
  order_items?: {
    product_variants?: {
      sku_variant: string;
      size?: string;
      color?: string;
      products?: {
        name: string;
      };
    };
  };
}

interface DeliveryBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryItems: ApprovedItem[];
  trackingNumber: string;
}

interface LabelData {
  sku: string;
  productName: string;
  variant: string;
  unitIndex: number;
}

interface GroupedLabels {
  sku: string;
  productName: string;
  variant: string;
  labels: LabelData[];
}

const DeliveryBarcodeModal = ({ 
  isOpen, 
  onClose, 
  deliveryItems,
  trackingNumber 
}: DeliveryBarcodeModalProps) => {

  // Generate labels for each approved unit
  const labels = useMemo(() => {
    const result: LabelData[] = [];

    deliveryItems.forEach(item => {
      if (item.quantity_approved > 0 && item.order_items?.product_variants) {
        const variant = item.order_items.product_variants;
        const productName = variant.products?.name || 'Producto';
        const variantText = [variant.size, variant.color].filter(Boolean).join(' - ');
        const sku = variant.sku_variant || '';

        // Create one label per approved unit
        for (let i = 0; i < item.quantity_approved; i++) {
          result.push({
            sku,
            productName,
            variant: variantText,
            unitIndex: i + 1
          });
        }
      }
    });

    return result;
  }, [deliveryItems]);

  // Group labels by SKU for individual printing
  const groupedLabels = useMemo(() => {
    const groups: Record<string, GroupedLabels> = {};

    labels.forEach(label => {
      if (!groups[label.sku]) {
        groups[label.sku] = {
          sku: label.sku,
          productName: label.productName,
          variant: label.variant,
          labels: []
        };
      }
      groups[label.sku].labels.push(label);
    });

    return Object.values(groups);
  }, [labels]);

  const totalApproved = labels.length;
  const uniqueProducts = groupedLabels.length;

  // Generate print HTML for a set of labels
  const generatePrintHtml = (labelsToPrint: LabelData[]) => {
    const labelsWithCompactText = labelsToPrint.map(label => ({
      ...label,
      compactText: label.variant ? `${label.productName} - ${label.variant}` : label.productName
    }));

    return `
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
              <svg id="barcode-${label.sku}-${label.unitIndex}"></svg>
              <div class="product-info">${label.compactText}</div>
            </div>
          `).join('')}
        </div>
        <script>
          ${labelsWithCompactText.map(label => `
            JsBarcode("#barcode-${label.sku}-${label.unitIndex}", "${label.sku}", {
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
    `;
  };

  const handlePrint = (labelsToPrint: LabelData[] = labels) => {
    if (labelsToPrint.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;

    printWindow.document.write(generatePrintHtml(labelsToPrint));
    printWindow.document.close();
  };

  const handlePrintAll = () => {
    handlePrint(labels);
  };

  const handlePrintBySku = (sku: string) => {
    const skuLabels = labels.filter(l => l.sku === sku);
    handlePrint(skuLabels);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Códigos de Barras - Productos Aprobados
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex gap-4 text-sm">
            <span><strong>{totalApproved}</strong> etiquetas</span>
            <span><strong>{uniqueProducts}</strong> productos únicos</span>
          </div>
          <Button onClick={handlePrintAll} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Todo
          </Button>
        </div>

        {/* Grouped Preview */}
        <div className="flex-1 overflow-y-auto space-y-3 p-2">
          {groupedLabels.map((group) => (
            <Collapsible key={group.sku} defaultOpen>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted cursor-pointer">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="w-4 h-4 transition-transform [&[data-state=open]]:rotate-180" />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {group.productName}
                          {group.variant && <span className="text-muted-foreground ml-1">- {group.variant}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          SKU: {group.sku} • {group.labels.length} {group.labels.length === 1 ? 'etiqueta' : 'etiquetas'}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintBySku(group.sku);
                      }}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 border-t">
                    {group.labels.map((label, index) => (
                      <BarcodeLabel
                        key={`${label.sku}-${label.unitIndex}`}
                        sku={label.sku}
                        productName={label.productName}
                        variant={label.variant}
                        index={index}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>

        {labels.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No hay productos aprobados para generar códigos de barras
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryBarcodeModal;
