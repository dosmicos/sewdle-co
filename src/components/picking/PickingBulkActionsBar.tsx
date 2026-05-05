import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Package, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PickingBulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  onMarkAsPacked: (orderIds: string[]) => Promise<void>;
  onClear: () => void;
}

export const PickingBulkActionsBar = ({
  selectedCount,
  selectedIds,
  onMarkAsPacked,
  onClear,
}: PickingBulkActionsBarProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleMarkAsPacked = async () => {
    setIsProcessing(true);
    try {
      await onMarkAsPacked(selectedIds);
      setShowConfirm(false);
      onClear();
    } catch (error) {
      console.error('Error in bulk action:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
        <div className="bg-primary text-primary-foreground shadow-lg rounded-lg px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            <span className="font-medium">
              {selectedCount} {selectedCount === 1 ? 'orden seleccionada' : 'órdenes seleccionadas'}
            </span>
          </div>

          <div className="h-8 w-px bg-primary-foreground/20" />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowConfirm(true)}
            disabled={isProcessing}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Marcar como EMPACADO
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            disabled={isProcessing}
            className="hover:bg-primary-foreground/10"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar acción masiva?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Estás a punto de marcar <strong>{selectedCount}</strong>{' '}
                {selectedCount === 1 ? 'orden' : 'órdenes'} como <strong>EMPACADO</strong>.
              </p>
              <p>Esta acción:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Cambiará el estado a "Listo para envío"</li>
                <li>Agregará la etiqueta "EMPACADO" en Shopify</li>
                <li>Registrará la fecha y hora actual</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkAsPacked}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Sí, marcar como EMPACADO
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
