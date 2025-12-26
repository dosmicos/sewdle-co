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
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Truck, 
  DollarSign, 
  CreditCard,
  Loader2
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
}

const InvoiceValidationModal: React.FC<InvoiceValidationModalProps> = ({
  open,
  onOpenChange,
  orderNumber,
  validationResult,
  isValidating,
  onConfirmEmit,
  isEmitting,
}) => {
  const hasErrors = validationResult && validationResult.errors.length > 0;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  const canEmit = validationResult && !hasErrors;

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
                  {validationResult.checks.deliveryCheck.passed ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Entrega (Contraentrega)</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {validationResult.checks.deliveryCheck.message}
                    </p>
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
            Cancelar
          </Button>
          <Button 
            onClick={onConfirmEmit} 
            disabled={!canEmit || isEmitting}
          >
            {isEmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Emitiendo...
              </>
            ) : hasErrors ? (
              'No se puede emitir'
            ) : (
              'Confirmar y Emitir'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceValidationModal;
