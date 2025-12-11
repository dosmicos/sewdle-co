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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Códigos de Barras - ${trackingNumber}</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; }
          .page { 
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            padding: 10px;
          }
          .barcode-label {
            border: 1px dashed #ccc;
            padding: 8px;
            text-align: center;
            page-break-inside: avoid;
            background: white;
          }
          .barcode-label svg {
            max-width: 100%;
            height: auto;
          }
          .product-name {
            font-size: 10px;
            font-weight: 600;
            margin-top: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .variant {
            font-size: 9px;
            color: #666;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          @media print {
            @page { margin: 5mm; }
            .barcode-label { border: 1px dashed #999; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${labels.map(label => `
            <div class="barcode-label">
              <svg id="barcode-${label.sku}-${label.unitIndex}"></svg>
              <div class="product-name">${label.productName}</div>
              <div class="variant">${label.variant}</div>
            </div>
          `).join('')}
        </div>
        <script>
          ${labels.map(label => `
            JsBarcode("#barcode-${label.sku}-${label.unitIndex}", "${label.sku}", {
              format: "CODE128",
              width: 1.2,
              height: 40,
              fontSize: 10,
              margin: 2,
              displayValue: true
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
