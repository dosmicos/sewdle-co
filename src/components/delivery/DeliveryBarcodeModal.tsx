import React, { useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Package } from 'lucide-react';
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

const DeliveryBarcodeModal = ({ 
  isOpen, 
  onClose, 
  deliveryItems,
  trackingNumber 
}: DeliveryBarcodeModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  // Generate labels for each approved unit
  const labels = useMemo(() => {
    const result: Array<{
      sku: string;
      productName: string;
      variant: string;
      unitIndex: number;
    }> = [];

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

  const totalApproved = labels.length;
  const uniqueProducts = new Set(labels.map(l => l.sku)).size;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Combinar nombre y variante para texto compacto
    const labelsWithCompactText = labels.map(label => ({
      ...label,
      compactText: label.variant ? `${label.productName} - ${label.variant}` : label.productName
    }));

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Códigos de Barras - ${trackingNumber}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page { 
            display: grid;
            grid-template-columns: repeat(2, 50mm);
            gap: 2mm;
            padding: 0;
          }
          .barcode-label {
            width: 50mm;
            height: 25mm;
            padding: 1mm;
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
            max-width: 48mm;
            height: auto;
          }
          .product-info {
            font-size: 5px;
            font-weight: 500;
            margin-top: 1px;
            line-height: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 48mm;
            color: #333;
          }
          @media print {
            @page { 
              size: 100mm auto;
              margin: 0;
            }
            body { margin: 0; padding: 0; }
            .page {
              gap: 0;
            }
            .barcode-label { 
              border: none;
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
              width: 2,
              height: 45,
              fontSize: 7,
              margin: 1,
              displayValue: true,
              textMargin: 0
            });
          `).join('')}
          setTimeout(() => { window.print(); window.close(); }, 500);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Todo
          </Button>
        </div>

        {/* Preview Grid */}
        <div 
          ref={printRef}
          className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {labels.map((label, index) => (
            <BarcodeLabel
              key={`${label.sku}-${index}`}
              sku={label.sku}
              productName={label.productName}
              variant={label.variant}
              index={index}
            />
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
