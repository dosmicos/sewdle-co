import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Package, Minus, Plus } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DeliveryItem {
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

interface DeliveryManualBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryItems: DeliveryItem[];
  trackingNumber: string;
}

interface LabelData {
  sku: string;
  productName: string;
  variant: string;
  unitIndex: number;
}

const DeliveryManualBarcodeModal = ({ 
  isOpen, 
  onClose, 
  deliveryItems,
  trackingNumber 
}: DeliveryManualBarcodeModalProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Solo mostrar items con aprobados
  const approvedItems = useMemo(() => 
    deliveryItems.filter(item => item.quantity_approved > 0),
    [deliveryItems]
  );

  // Inicializar cantidades con quantity_approved cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      approvedItems.forEach(item => {
        initial[item.id] = item.quantity_approved;
      });
      setQuantities(initial);
    }
  }, [approvedItems, isOpen]);

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, value)
    }));
  };

  const incrementQuantity = (itemId: string) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
  };

  const decrementQuantity = (itemId: string) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) - 1)
    }));
  };

  // Calcular total de etiquetas a imprimir
  const totalLabels = useMemo(() => 
    Object.values(quantities).reduce((sum, qty) => sum + qty, 0),
    [quantities]
  );

  const generatePrintHtml = (labels: LabelData[]) => {
    const labelsWithCompactText = labels.map(label => ({
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
    `;
  };

  const handlePrint = () => {
    const labels: LabelData[] = [];
    
    approvedItems.forEach(item => {
      const qty = quantities[item.id] || 0;
      if (qty > 0) {
        const variant = item.order_items?.product_variants;
        const productName = variant?.products?.name || 'Producto';
        const variantText = [variant?.size, variant?.color].filter(Boolean).join(' - ');
        const sku = variant?.sku_variant || '';
        
        for (let i = 0; i < qty; i++) {
          labels.push({ sku, productName, variant: variantText, unitIndex: i + 1 });
        }
      }
    });

    if (labels.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;

    printWindow.document.write(generatePrintHtml(labels));
    printWindow.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Imprimir Códigos de Barras - Selección Manual
          </DialogTitle>
        </DialogHeader>

        {approvedItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8 text-muted-foreground">
            No hay productos aprobados para generar códigos de barras
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center w-32">Aprobados</TableHead>
                    <TableHead className="text-center w-40">Etiquetas a Imprimir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvedItems.map(item => {
                    const variant = item.order_items?.product_variants;
                    const productName = variant?.products?.name || 'Producto';
                    const variantText = [variant?.size, variant?.color].filter(Boolean).join(' - ');
                    const sku = variant?.sku_variant || '';
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {productName}
                              {variantText && <span className="text-muted-foreground ml-1">- {variantText}</span>}
                            </span>
                            <span className="text-xs text-muted-foreground">SKU: {sku}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-green-600">{item.quantity_approved}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => decrementQuantity(item.id)}
                              disabled={(quantities[item.id] || 0) <= 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <Input
                              type="number"
                              min="0"
                              value={quantities[item.id] || 0}
                              onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                              className="w-16 text-center"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => incrementQuantity(item.id)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="border-t pt-4">
              <div className="flex items-center justify-between w-full">
                <span className="text-sm text-muted-foreground">
                  Total: <strong>{totalLabels}</strong> {totalLabels === 1 ? 'etiqueta' : 'etiquetas'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePrint} disabled={totalLabels === 0} className="gap-2">
                    <Printer className="w-4 h-4" />
                    Imprimir Selección
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DeliveryManualBarcodeModal;
