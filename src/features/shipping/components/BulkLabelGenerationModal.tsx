import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  Check,
  Loader2,
  Printer,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PickingOrder } from '@/hooks/usePickingOrders';
import { CARRIER_NAMES, CarrierCode } from '../types/envia';
import { useBulkLabelGeneration, BulkLabelItem } from '../hooks/useBulkLabelGeneration';
import { mergeLabelPdfs, openPdfForPrint } from '../lib/mergeLabelPdfs';

interface BulkLabelGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: PickingOrder[];
  organizationId: string;
  onCompleted: () => void;
}

const statusIcon = (status: BulkLabelItem['status']) => {
  switch (status) {
    case 'generating':
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case 'success':
      return <Check className="w-4 h-4 text-green-600" />;
    case 'already_had_label':
      return <Check className="w-4 h-4 text-gray-400" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-gray-400" />;
    default:
      return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
  }
};

export const BulkLabelGenerationModal: React.FC<BulkLabelGenerationModalProps> = ({
  open,
  onOpenChange,
  orders,
  organizationId,
  onCompleted,
}) => {
  const { items, isRunning, summary, start, cancel, retryItem, retryAllFailed, reset } =
    useBulkLabelGeneration();
  const [isPrinting, setIsPrinting] = useState(false);
  const hasRunRef = useRef(false);

  const hasStarted = items.length > 0;
  const finished = hasStarted && !isRunning && summary.done === summary.total;
  const printableItems = items.filter(
    item => (item.status === 'success' || item.status === 'already_had_label') && item.labelUrl
  );

  useEffect(() => {
    if (open) {
      hasRunRef.current = false;
      reset();
    }
  }, [open, reset]);

  const handleStart = () => {
    hasRunRef.current = true;
    void start(orders, organizationId);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && isRunning) return; // no cerrar a mitad de batch
    if (!nextOpen && hasRunRef.current) {
      onCompleted();
    }
    onOpenChange(nextOpen);
  };

  const handlePrintAll = async () => {
    if (printableItems.length === 0 || isPrinting) return;
    // Abrir la ventana de forma síncrona para evitar el popup blocker
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    setIsPrinting(true);
    try {
      const result = await mergeLabelPdfs(printableItems.map(item => item.labelUrl!));
      if (!result.blob) {
        printWindow?.close();
        toast.error('No se pudo preparar el PDF combinado');
        return;
      }
      if (result.skippedCount > 0) {
        toast.warning(`${result.skippedCount} etiqueta(s) no se pudieron incluir en el PDF`);
      }
      openPdfForPrint(result.blob, printWindow);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        onInteractOutside={e => {
          if (isRunning) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Generación masiva de guías
          </DialogTitle>
          <DialogDescription>
            {hasStarted
              ? `${summary.done} de ${summary.total} pedidos procesados`
              : `Se generarán guías para ${orders.length} pedido${orders.length === 1 ? '' : 's'}. La transportadora se asigna automáticamente. Los pedidos contraentrega usan el total del pedido como monto a cobrar.`}
          </DialogDescription>
        </DialogHeader>

        {hasStarted && (
          <Progress value={summary.total > 0 ? (summary.done / summary.total) * 100 : 0} />
        )}

        {hasStarted && (
          <ScrollArea className="flex-1 min-h-0 max-h-[45vh] pr-3">
            <div className="space-y-1">
              {items.map(item => (
                <div
                  key={item.orderId}
                  className="flex items-center gap-3 py-2 px-2 rounded-md border border-transparent hover:border-gray-200 text-sm"
                >
                  {statusIcon(item.status)}
                  <span className="font-medium w-24 shrink-0">#{item.orderNumber}</span>
                  <div className="flex-1 min-w-0 truncate">
                    {item.status === 'success' && (
                      <span className="text-green-700">
                        {item.trackingNumber}
                        {item.carrier && (
                          <span className="text-muted-foreground">
                            {' '}· {CARRIER_NAMES[item.carrier as CarrierCode] || item.carrier}
                          </span>
                        )}
                      </span>
                    )}
                    {item.status === 'already_had_label' && (
                      <span className="text-muted-foreground">
                        <Badge variant="secondary" className="mr-2">Ya tenía guía</Badge>
                        {item.trackingNumber}
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-red-600">{item.errorMessage}</span>
                    )}
                    {item.status === 'cancelled' && (
                      <span className="text-muted-foreground">Cancelado</span>
                    )}
                    {item.status === 'generating' && (
                      <span className="text-muted-foreground">Generando guía…</span>
                    )}
                  </div>
                  {item.status === 'error' && !isRunning && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => void retryItem(item.orderId)}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Reintentar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {finished && (
          <div className="text-sm text-muted-foreground">
            {summary.succeeded} guía{summary.succeeded === 1 ? '' : 's'} creada
            {summary.succeeded === 1 ? '' : 's'}
            {summary.alreadyHad > 0 && `, ${summary.alreadyHad} ya existía${summary.alreadyHad === 1 ? '' : 'n'}`}
            {summary.failed > 0 && (
              <span className="text-red-600">, {summary.failed} con error</span>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          {!hasStarted && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleStart} disabled={orders.length === 0}>
                <Truck className="w-4 h-4 mr-2" />
                Generar {orders.length} guía{orders.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {isRunning && (
            <Button variant="outline" onClick={cancel}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar restantes
            </Button>
          )}
          {finished && (
            <>
              {summary.failed > 0 && (
                <Button variant="outline" onClick={() => void retryAllFailed()}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reintentar fallidos ({summary.failed})
                </Button>
              )}
              {printableItems.length > 0 && (
                <Button onClick={() => void handlePrintAll()} disabled={isPrinting}>
                  {isPrinting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4 mr-2" />
                  )}
                  Imprimir todas ({printableItems.length})
                </Button>
              )}
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cerrar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
