import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Send,
  User,
  DollarSign,
  Truck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ValidationResult } from '@/components/alegra/InvoiceValidationModal';

export interface BulkValidationResult {
  orderId: string;
  orderNumber: string;
  customerName: string;
  total: number;
  validationResult: ValidationResult;
}

interface BulkValidationResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: BulkValidationResult[];
  isEmitting: boolean;
  onEmitValid: () => void;
  manualDeliveryConfirmations: Map<string, boolean>;
  onManualDeliveryChange: (orderId: string, confirmed: boolean) => void;
}

const BulkValidationResultsModal: React.FC<BulkValidationResultsModalProps> = ({
  open,
  onOpenChange,
  results,
  isEmitting,
  onEmitValid,
  manualDeliveryConfirmations,
  onManualDeliveryChange,
}) => {
  const [expandedOrders, setExpandedOrders] = React.useState<Set<string>>(new Set());

  // Helper to check if an order is valid (including manual confirmations)
  const isOrderValid = (result: BulkValidationResult) => {
    if (result.validationResult.valid) return true;
    
    // Check if manual confirmation resolves the delivery error
    const hasManualConfirmation = manualDeliveryConfirmations.get(result.orderId);
    if (!hasManualConfirmation) return false;
    
    const deliveryCheck = result.validationResult.checks.deliveryCheck;
    const isDeliveryOnlyError = deliveryCheck && !deliveryCheck.passed &&
      result.validationResult.errors.every(e => 
        e.toLowerCase().includes('contraentrega') || 
        e.toLowerCase().includes('guía') || 
        e.toLowerCase().includes('entrega')
      );
    
    return isDeliveryOnlyError;
  };

  const validResults = results.filter(r => isOrderValid(r));
  const errorResults = results.filter(r => !isOrderValid(r));
  const warningResults = results.filter(
    r => r.validationResult.valid && r.validationResult.warnings.length > 0
  );

  const toggleExpanded = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const getStatusIcon = (result: BulkValidationResult) => {
    if (isOrderValid(result)) {
      if (result.validationResult.warnings.length > 0 || manualDeliveryConfirmations.get(result.orderId)) {
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      }
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getStatusBadge = (result: BulkValidationResult) => {
    if (isOrderValid(result)) {
      if (manualDeliveryConfirmations.get(result.orderId)) {
        return <Badge className="bg-amber-500 hover:bg-amber-600">Confirmada manualmente</Badge>;
      }
      if (result.validationResult.warnings.length > 0) {
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Advertencia</Badge>;
      }
      return <Badge className="bg-green-600 hover:bg-green-700">Válida</Badge>;
    }
    return <Badge variant="destructive">Error</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] grid grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 Resultados de Validación Masiva
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto pr-2">
          {/* Summary */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-semibold text-green-800 dark:text-green-400">
                  {validResults.length}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">Válidas</div>
              </div>
            </div>
            {warningResults.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <div className="font-semibold text-yellow-800 dark:text-yellow-400">
                    {warningResults.length}
                  </div>
                  <div className="text-xs text-yellow-600 dark:text-yellow-500">Con advertencias</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <div className="font-semibold text-red-800 dark:text-red-400">
                  {errorResults.length}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">Con errores</div>
              </div>
            </div>
          </div>

          {/* Success message if all valid */}
          {errorResults.length === 0 && results.length > 0 && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20 mb-4">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-400">
                Todas las facturas están listas
              </AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                Las {validResults.length} facturas seleccionadas pasaron la validación y pueden emitirse.
              </AlertDescription>
            </Alert>
          )}

          {/* Error warning */}
          {errorResults.length > 0 && validResults.length > 0 && (
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 mb-4">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-400">
                Algunas facturas tienen errores
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                {errorResults.length} factura(s) no pasaron la validación. Puedes emitir las {validResults.length} válidas.
              </AlertDescription>
            </Alert>
          )}

          {/* All have errors */}
          {errorResults.length > 0 && validResults.length === 0 && (
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950/20 mb-4">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800 dark:text-red-400">
                Ninguna factura puede emitirse
              </AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-300">
                Todas las facturas seleccionadas tienen errores. Revisa y corrige los problemas indicados.
              </AlertDescription>
            </Alert>
          )}

          {/* Results list */}
          <div className="space-y-2 pb-2">
              {results.map(result => {
                const isExpanded = expandedOrders.has(result.orderId);
                const checks = result.validationResult.checks;
                
                return (
                  <Collapsible key={result.orderId} open={isExpanded}>
                    <div
                      className={`rounded-lg border p-3 transition-colors ${
                        !result.validationResult.valid
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                          : result.validationResult.warnings.length > 0
                          ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/20'
                          : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                      }`}
                    >
                      <CollapsibleTrigger
                        onClick={() => toggleExpanded(result.orderId)}
                        className="w-full"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(result)}
                            <div className="text-left">
                              <div className="font-medium">#{result.orderNumber}</div>
                              <div className="text-xs text-muted-foreground">
                                {result.customerName}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">
                              ${result.total.toLocaleString('es-CO')}
                            </span>
                            {getStatusBadge(result)}
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                          {/* Errors first (blocking) */}
                          {result.validationResult.errors.length > 0 && (
                            <div className="p-2 rounded bg-red-100 dark:bg-red-900/30">
                              <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                                Errores que bloquean la emisión:
                              </div>
                              <ul className="text-xs text-red-600 dark:text-red-300 space-y-1 list-disc list-inside">
                                {result.validationResult.errors.map((err, i) => (
                                  <li key={i} className="whitespace-normal break-words">{err}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Warnings (non-blocking) */}
                          {result.validationResult.warnings.length > 0 && (
                            <div className="p-2 rounded bg-yellow-100 dark:bg-yellow-900/30">
                              <div className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                                Advertencias:
                              </div>
                              <ul className="text-xs text-yellow-600 dark:text-yellow-300 space-y-1 list-disc list-inside">
                                {result.validationResult.warnings.map((warn, i) => (
                                  <li key={i} className="whitespace-normal break-words">{warn}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Manual delivery confirmation checkbox for orders without shipping label */}
                          {checks.deliveryCheck && !checks.deliveryCheck.passed && 
                           (checks.deliveryCheck.status === 'sin_guia' || checks.deliveryCheck.status === 'pending' || 
                            (checks.deliveryCheck.status && !['delivered', 'entregado', 'manual_confirmed'].includes(checks.deliveryCheck.status.toLowerCase()))) && (
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  id={`manual-delivery-${result.orderId}`}
                                  checked={manualDeliveryConfirmations.get(result.orderId) || false}
                                  onCheckedChange={(checked) => onManualDeliveryChange(result.orderId, checked === true)}
                                  className="mt-0.5"
                                />
                                <label 
                                  htmlFor={`manual-delivery-${result.orderId}`}
                                  className="text-sm text-amber-800 dark:text-amber-300 cursor-pointer"
                                >
                                  Confirmo que este pedido ya fue entregado al cliente
                                </label>
                              </div>
                            </div>
                          )}

                          {/* Verification details */}
                          <div className="p-2 rounded bg-muted/50">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Verificaciones:
                            </div>
                            <ul className="text-xs space-y-1.5">
                              {/* Delivery check first (most important for COD) */}
                              {checks.deliveryCheck && (
                                <li className="flex items-center gap-2">
                                  {checks.deliveryCheck.passed || manualDeliveryConfirmations.get(result.orderId) ? (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                  )}
                                  <Truck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className={`whitespace-normal break-words ${checks.deliveryCheck.passed || manualDeliveryConfirmations.get(result.orderId) ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
                                    {manualDeliveryConfirmations.get(result.orderId) && !checks.deliveryCheck.passed
                                      ? 'Entrega confirmada manualmente'
                                      : checks.deliveryCheck.message}
                                  </span>
                                </li>
                              )}
                              {/* Client check */}
                              <li className="flex items-center gap-2">
                                {checks.clientCheck?.passed ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                                )}
                                <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className={`whitespace-normal break-words ${checks.clientCheck?.passed ? 'text-muted-foreground' : 'text-red-600 dark:text-red-400'}`}>
                                  {checks.clientCheck?.message}
                                </span>
                              </li>
                              {/* Price check */}
                              <li className="flex items-center gap-2">
                                {checks.priceCheck?.passed ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
                                )}
                                <DollarSign className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className={`whitespace-normal break-words ${checks.priceCheck?.passed ? 'text-muted-foreground' : 'text-yellow-600 dark:text-yellow-400'}`}>
                                  {checks.priceCheck?.message}
                                </span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEmitting}>
            {errorResults.length > 0 && validResults.length === 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          {validResults.length > 0 && (
            <Button onClick={onEmitValid} disabled={isEmitting}>
              {isEmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Emitiendo...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Emitir {validResults.length} Factura{validResults.length !== 1 ? 's' : ''} Válida{validResults.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkValidationResultsModal;
