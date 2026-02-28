import { useState, useEffect } from "react";
import { Calculator, DollarSign, Receipt, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useDeliveryPayments, DeliveryPaymentCalculation } from "@/hooks/useDeliveryPayments";
import { useToast } from "@/hooks/use-toast";

interface DeliveryPaymentManagerProps {
  deliveryId: string;
  onPaymentCreated?: () => void;
}

interface PaymentFormData {
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
}

interface AdvanceAdjustmentData {
  customAdvanceDeduction: number;
  advanceNotes: string;
}

export const DeliveryPaymentManager = ({ deliveryId, onPaymentCreated }: DeliveryPaymentManagerProps) => {
  const { payments, calculatePayment, createPayment, markAsPaid } = useDeliveryPayments();
  const { toast } = useToast();
  const [calculation, setCalculation] = useState<DeliveryPaymentCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isAdvanceAdjustmentOpen, setIsAdvanceAdjustmentOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: "",
    reference_number: "",
    notes: ""
  });
  const [advanceAdjustment, setAdvanceAdjustment] = useState<AdvanceAdjustmentData>({
    customAdvanceDeduction: 0,
    advanceNotes: ""
  });

  // Find existing payment for this delivery
  const existingPayment = payments.find(p => p.delivery_id === deliveryId);

  const handleCalculatePayment = async (customAdvance?: number) => {
    setIsCalculating(true);
    try {
      const result = await calculatePayment(deliveryId, customAdvance);
      setCalculation(result);
      // Update advance adjustment max value
      if (result && result.total_advance_available !== undefined && result.advance_already_used !== undefined) {
        const maxDeduction = result.total_advance_available - result.advance_already_used;
        if (advanceAdjustment.customAdvanceDeduction > maxDeduction) {
          setAdvanceAdjustment(prev => ({ ...prev, customAdvanceDeduction: maxDeduction }));
        }
      }
    } catch (error) {
      console.error('Error calculating payment:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCreatePayment = async (useCustomAdvance: boolean = false) => {
    try {
      const customAdvance = useCustomAdvance ? advanceAdjustment.customAdvanceDeduction : undefined;
      const advanceNotes = useCustomAdvance ? advanceAdjustment.advanceNotes : undefined;
      
      await createPayment(deliveryId, customAdvance, advanceNotes);
      onPaymentCreated?.();
      setIsAdvanceAdjustmentOpen(false);
      toast({
        title: "Pago creado",
        description: "Se ha creado el registro de pago para esta entrega"
      });
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };

  const handleAdvanceAdjustmentChange = async (value: number) => {
    setAdvanceAdjustment(prev => ({ ...prev, customAdvanceDeduction: value }));
    // Recalculate with new advance deduction
    await handleCalculatePayment(value);
  };

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingPayment) return;

    try {
      await markAsPaid(existingPayment.id, paymentFormData);
      setIsPaymentDialogOpen(false);
      setPaymentFormData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: "",
        reference_number: "",
        notes: ""
      });
      onPaymentCreated?.();
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `COP $${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      paid: "default",
      partial: "outline",
      cancelled: "destructive"
    } as const;

    const labels = {
      pending: "Pendiente",
      paid: "Pagado",
      partial: "Parcial",
      cancelled: "Cancelado"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  useEffect(() => {
    handleCalculatePayment();
  }, [deliveryId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Información de Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Payment Calculation */}
        {calculation && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Cálculo de Pago
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Entregado:</span>
                <span className="ml-2 font-medium">{calculation.total_units} unidades</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unidades Facturables:</span>
                <span className="ml-2 font-medium">{calculation.billable_units} unidades</span>
              </div>
              <div>
                <span className="text-muted-foreground">Método de Pago:</span>
                <span className="ml-2 font-medium capitalize">{calculation.workshop_payment_method}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Monto Bruto:</span>
                <span className="ml-2 font-medium">{formatCurrency(calculation.gross_amount)}</span>
              </div>
              {calculation.items_without_workshop_price > 0 && (
                <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Precio de taller no configurado</p>
                    <p className="text-amber-700">
                      {calculation.items_without_workshop_price} {calculation.items_without_workshop_price === 1 ? 'producto usa' : 'productos usan'} el precio de venta en lugar del precio del taller.
                      Configure los precios en el Módulo Financiero → Precios por Taller.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Deducción Anticipos:</span>
                <span className="ml-2 font-medium">-{formatCurrency(calculation.advance_deduction)}</span>
              </div>
              {calculation.total_advance_available > 0 && (
                <>
                  <div>
                    <span className="text-muted-foreground">Anticipo Total:</span>
                    <span className="ml-2 font-medium">{formatCurrency(calculation.total_advance_available)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Anticipo Usado:</span>
                    <span className="ml-2 font-medium">{formatCurrency(calculation.advance_already_used)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Anticipo Disponible:</span>
                    <span className="ml-2 font-medium">{formatCurrency(calculation.total_advance_available - calculation.advance_already_used)}</span>
                  </div>
                </>
              )}
              <div className="col-span-2 pt-2 border-t">
                <span className="text-muted-foreground">Monto Neto a Pagar:</span>
                <span className="ml-2 font-bold text-lg">{formatCurrency(calculation.net_amount)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Existing Payment Info */}
        {existingPayment && (
          <div className="border rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Estado del Pago
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Estado:</span>
                <span className="ml-2">{getPaymentStatusBadge(existingPayment.payment_status)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Monto Neto:</span>
                <span className="ml-2 font-medium">{formatCurrency(existingPayment.net_amount)}</span>
              </div>
              {existingPayment.payment_date && (
                <div>
                  <span className="text-muted-foreground">Fecha de Pago:</span>
                  <span className="ml-2">{existingPayment.payment_date}</span>
                </div>
              )}
              {existingPayment.payment_method && (
                <div>
                  <span className="text-muted-foreground">Método:</span>
                  <span className="ml-2">{existingPayment.payment_method}</span>
                </div>
              )}
              {existingPayment.reference_number && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Referencia:</span>
                  <span className="ml-2">{existingPayment.reference_number}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          {!existingPayment && calculation && (
            <>
              {/* Always show adjust advance button when advances are available */}
              {calculation.total_advance_available > 0 && (calculation.total_advance_available - calculation.advance_already_used) > 0 && (
                <Dialog open={isAdvanceAdjustmentOpen} onOpenChange={setIsAdvanceAdjustmentOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Ajustar Anticipo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Ajustar Deducción de Anticipo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-muted/50 p-3 rounded-lg text-sm">
                        <p>Especifica cuánto del anticipo disponible deseas descontar en esta entrega.</p>
                        <p>El ajuste se aplicará solo a esta entrega específica.</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Anticipo Total:</span>
                          <span className="ml-2 font-medium">{formatCurrency(calculation.total_advance_available)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ya Descontado:</span>
                          <span className="ml-2 font-medium">{formatCurrency(calculation.advance_already_used)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Disponible:</span>
                          <span className="ml-2 font-medium">{formatCurrency(calculation.total_advance_available - calculation.advance_already_used)}</span>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="custom_advance">Anticipo a Descontar en esta Entrega</Label>
                        <Input
                          id="custom_advance"
                          type="number"
                          min="0"
                          max={calculation.total_advance_available - calculation.advance_already_used}
                          step="1000"
                          value={advanceAdjustment.customAdvanceDeduction}
                          onChange={(e) => handleAdvanceAdjustmentChange(Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>

                      <div>
                        <Label htmlFor="advance_notes">Notas sobre el Ajuste</Label>
                        <Textarea
                          id="advance_notes"
                          value={advanceAdjustment.advanceNotes}
                          onChange={(e) => setAdvanceAdjustment(prev => ({ ...prev, advanceNotes: e.target.value }))}
                          placeholder="Razón del ajuste del anticipo"
                          rows={2}
                        />
                      </div>

                      {calculation && (
                        <div className="bg-green-50 p-3 rounded-lg">
                          <p className="text-sm text-green-700">
                            <strong>Nuevo Monto Neto a Pagar: {formatCurrency(calculation.net_amount)}</strong>
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setIsAdvanceAdjustmentOpen(false)}>
                          Cancelar
                        </Button>
                        <Button 
                          onClick={() => handleCreatePayment(true)}
                          disabled={advanceAdjustment.customAdvanceDeduction > (calculation.total_advance_available - calculation.advance_already_used)}
                        >
                          Crear Pago con Ajuste
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Standard create payment button */}
              <Button onClick={() => handleCreatePayment(false)} className="flex-1">
                <DollarSign className="w-4 h-4 mr-2" />
                Crear Registro de Pago
              </Button>
            </>
          )}

          {existingPayment && existingPayment.payment_status === 'pending' && (
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Marcar como Pagado
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Pago</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleMarkAsPaid} className="space-y-4">
                  <div>
                    <Label htmlFor="payment_date">Fecha de Pago</Label>
                    <Input
                      id="payment_date"
                      type="date"
                      value={paymentFormData.payment_date}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment_method">Método de Pago</Label>
                    <Select
                      value={paymentFormData.payment_method}
                      onValueChange={(value) => setPaymentFormData(prev => ({ ...prev, payment_method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="reference_number">Número de Referencia</Label>
                    <Input
                      id="reference_number"
                      value={paymentFormData.reference_number}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                      placeholder="Número de transferencia, cheque, etc."
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Notas adicionales sobre el pago"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      Confirmar Pago
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Button
            variant="outline"
            onClick={() => handleCalculatePayment()}
            disabled={isCalculating}
          >
            <Calculator className="w-4 h-4 mr-2" />
            {isCalculating ? 'Calculando...' : 'Recalcular'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
