import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Truck, 
  DollarSign, 
  CreditCard,
  Loader2,
  Send,
  Package,
  Undo2,
  HelpCircle,
  UserCheck,
  AlertOctagon,
} from 'lucide-react';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    clientCheck: {
      passed: boolean;
      matchedBy?: 'phone' | 'identification' | 'email' | 'created' | 'rate_limited';
      message: string;
    };
    deliveryCheck?: {
      passed: boolean;
      status?: string;
      message: string;
      detail?: string;
    };
    priceCheck: {
      passed: boolean;
      invoiceTotal: number;
      shopifyTotal: number;
      message: string;
    };
    paymentCheck: {
      passed: boolean;
      message: string;
    };
  };
}

interface InvoiceValidationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  validationResult: ValidationResult | null;
  isValidating: boolean;
  onConfirmEmit: () => void;
  isEmitting: boolean;
  manualDeliveryConfirmed?: boolean;
  onManualDeliveryChange?: (confirmed: boolean) => void;
}

// Helper component for delivery status display
const DeliveryStatusAlert: React.FC<{
  status: string;
  message: string;
  detail?: string;
}> = ({ status, message, detail }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'sin_guia':
        return <Package className="h-4 w-4 text-amber-600" />;
      case 'sin_tracking':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'in_transit':
      case 'en_transito':
      case 'recogido':
      case 'collected':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'en_bodega':
      case 'in_warehouse':
        return <Package className="h-4 w-4 text-blue-600" />;
      case 'devuelto':
      case 'returned':
        return <Undo2 className="h-4 w-4 text-red-600" />;
      case 'cancelled':
      case 'cancelado':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'novedad':
      case 'exception':
        return <AlertOctagon className="h-4 w-4 text-orange-600" />;
      case 'delivered':
      case 'entregado':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'manual_confirmed':
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBgColor = () => {
    switch (status) {
      case 'sin_guia':
      case 'sin_tracking':
        return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
      case 'in_transit':
      case 'en_transito':
      case 'recogido':
      case 'collected':
      case 'en_bodega':
      case 'in_warehouse':
      case 'pending':
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
      case 'devuelto':
      case 'returned':
      case 'cancelled':
      case 'cancelado':
      case 'error':
        return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
      case 'novedad':
      case 'exception':
        return 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
      case 'delivered':
      case 'entregado':
      case 'manual_confirmed':
        return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  return (
    <div className={`mt-2 p-3 rounded-lg border ${getBgColor()}`}>
      <div className="flex items-start gap-2">
        {getStatusIcon()}
        <div className="flex-1">
          <span className="font-medium text-sm">{message}</span>
          {detail && (
            <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
          )}
        </div>
      </div>
    </div>
  );
};

const InvoiceValidationModal: React.FC<InvoiceValidationModalProps> = ({
  open,
  onOpenChange,
  orderNumber,
  validationResult,
  isValidating,
  onConfirmEmit,
  isEmitting,
  manualDeliveryConfirmed,
  onManualDeliveryChange,
}) => {
  const hasErrors = validationResult && validationResult.errors.length > 0;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  
  // Check if the only error is delivery-related and can be resolved with manual confirmation
  const deliveryCheck = validationResult?.checks.deliveryCheck;
  const canResolveWithManualConfirmation = hasErrors && deliveryCheck && !deliveryCheck.passed &&
    (deliveryCheck.status === 'sin_guia' || deliveryCheck.status === 'pending' ||
     (deliveryCheck.status && !['delivered', 'entregado', 'manual_confirmed'].includes(deliveryCheck.status.toLowerCase()))) &&
    validationResult?.errors.every(e => 
      e.toLowerCase().includes('contraentrega') || 
      e.toLowerCase().includes('guía') || 
      e.toLowerCase().includes('entrega')
    );
  
  // Can emit if no errors OR if manual confirmation resolves the only error
  const canEmit = validationResult && (!hasErrors || (canResolveWithManualConfirmation && manualDeliveryConfirmed));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isValidating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : hasErrors ? (
              <XCircle className="h-5 w-5 text-destructive" />
            ) : hasWarnings ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            Validación Pre-Emisión #{orderNumber}
          </DialogTitle>
        </DialogHeader>

        {isValidating ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Validando pedido...</p>
          </div>
        ) : validationResult ? (
          <div className="space-y-4">
            {/* Errors */}
            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Errores (no se puede emitir)</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validationResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-400">Advertencias</AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validationResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {!hasErrors && !hasWarnings && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-400">Todo listo para emitir</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Todas las validaciones pasaron correctamente. Puedes proceder con la emisión a DIAN.
                </AlertDescription>
              </Alert>
            )}

            {/* Validation Checks */}
            <div className="space-y-3 pt-2">
              {/* Client Check */}
              <div className="flex items-start gap-3">
                {validationResult.checks.clientCheck.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Cliente</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.checks.clientCheck.message}
                  </p>
                </div>
              </div>

              {/* Delivery Check (only for COD) */}
              {validationResult.checks.deliveryCheck && (
                <div className="flex items-start gap-3">
                  {validationResult.checks.deliveryCheck.passed || manualDeliveryConfirmed ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Entrega (Contraentrega)</span>
                    </div>
                    
                    {/* Detailed delivery status alert */}
                    {!validationResult.checks.deliveryCheck.passed && !manualDeliveryConfirmed && (
                      <DeliveryStatusAlert 
                        status={validationResult.checks.deliveryCheck.status || 'unknown'}
                        message={validationResult.checks.deliveryCheck.message}
                        detail={validationResult.checks.deliveryCheck.detail}
                      />
                    )}
                    
                    {/* Show success message when passed or manually confirmed */}
                    {(validationResult.checks.deliveryCheck.passed || manualDeliveryConfirmed) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {manualDeliveryConfirmed && !validationResult.checks.deliveryCheck.passed
                          ? 'Entrega confirmada manualmente'
                          : validationResult.checks.deliveryCheck.message}
                      </p>
                    )}
                    
                    {/* Manual delivery confirmation checkbox */}
                    {canResolveWithManualConfirmation && onManualDeliveryChange && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="manual-delivery-confirm"
                            checked={manualDeliveryConfirmed || false}
                            onCheckedChange={(checked) => onManualDeliveryChange(checked === true)}
                            className="mt-0.5"
                          />
                          <label 
                            htmlFor="manual-delivery-confirm"
                            className="text-sm text-amber-800 dark:text-amber-300 cursor-pointer"
                          >
                            Confirmo que este pedido ya fue entregado al cliente
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Price Check */}
              <div className="flex items-start gap-3">
                {validationResult.checks.priceCheck.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Precio</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.checks.priceCheck.message}
                  </p>
                </div>
              </div>

              {/* Payment Check */}
              <div className="flex items-start gap-3">
                {validationResult.checks.paymentCheck.passed ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Pago</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {validationResult.checks.paymentCheck.message}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEmitting}>
            {hasErrors && !canEmit ? 'Volver a editar' : 'Cancelar'}
          </Button>
          {canEmit && (
            <Button 
              onClick={onConfirmEmit} 
              disabled={isEmitting}
            >
              {isEmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Emitiendo a DIAN...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirmar y Emitir a DIAN
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceValidationModal;
