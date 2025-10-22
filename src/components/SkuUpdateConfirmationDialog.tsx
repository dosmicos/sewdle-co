import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Package, ShoppingCart, TrendingUp, RefreshCw } from 'lucide-react';
import { SkuUpdateSafety } from '@/hooks/useVariantSkuUpdate';

interface SkuUpdateConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  safetyInfo: SkuUpdateSafety | null;
  loading: boolean;
}

const SkuUpdateConfirmationDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  safetyInfo, 
  loading 
}: SkuUpdateConfirmationDialogProps) => {
  if (!safetyInfo) return null;

  const hasReferences = Object.values(safetyInfo.references).some(count => count > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Actualizar SKU de Variante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">SKU actual:</span> {safetyInfo.current_sku}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">Nuevo SKU:</span> {safetyInfo.new_sku}
            </p>
          </div>

          {safetyInfo.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Advertencias importantes:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {safetyInfo.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {hasReferences && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Esta variante está siendo utilizada en:</h4>
              <div className="grid grid-cols-2 gap-3">
                {safetyInfo.references.order_items > 0 && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <ShoppingCart className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Órdenes</p>
                      <p className="text-xs text-muted-foreground">
                        {safetyInfo.references.order_items} registros
                      </p>
                    </div>
                  </div>
                )}
                
                {safetyInfo.references.inventory_replenishment > 0 && (
                  <div className="flex items-center gap-2 p-3 border rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Registros de Reposición</p>
                      <p className="text-xs text-muted-foreground">
                        {safetyInfo.references.inventory_replenishment} registros
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {safetyInfo.pending_deliveries > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">
                  Hay {safetyInfo.pending_deliveries} entregas pendientes de sincronizar con Shopify
                </p>
                <p className="text-sm mt-1">
                  Cambiar el SKU podría afectar la sincronización de estas entregas.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-sm text-blue-900 mb-2">
              ¿Qué sucederá al actualizar el SKU?
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Se actualizará el SKU de la variante</li>
              <li>• Se mantendrán todas las referencias existentes</li>
              <li>• Se realizará un seguimiento de todos los registros afectados</li>
              {hasReferences && (
                <li>• Las referencias seguirán funcionando normalmente</li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Actualizando...' : 'Confirmar Actualización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SkuUpdateConfirmationDialog;