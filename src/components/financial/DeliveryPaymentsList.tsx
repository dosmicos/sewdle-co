import { useState, useMemo } from "react";
import { useDeliveryPayments } from "@/hooks/useDeliveryPayments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search, 
  Filter, 
  DollarSign, 
  CheckCircle, 
  Download,
  Calculator,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentFormData {
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
}

export const DeliveryPaymentsList = () => {
  const { payments, loading, calculatePayment, createPayment, markAsPaid, deletePayment, refetch } = useDeliveryPayments();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workshopFilter, setWorkshopFilter] = useState("all");
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: "",
    reference_number: "",
    notes: ""
  });

  // Get unique workshops for filter
  const workshops = useMemo(() => {
    const uniqueWorkshops = Array.from(new Set(payments.map(p => p.workshop_name).filter(Boolean)));
    return uniqueWorkshops.sort();
  }, [payments]);

  // Filter payments based on search and filters
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const matchesSearch = 
        payment.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.workshop_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || payment.payment_status === statusFilter;
      const matchesWorkshop = workshopFilter === "all" || payment.workshop_name === workshopFilter;
      
      return matchesSearch && matchesStatus && matchesWorkshop;
    });
  }, [payments, searchTerm, statusFilter, workshopFilter]);

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

  const handleSelectPayment = (paymentId: string, checked: boolean) => {
    if (checked) {
      setSelectedPayments(prev => [...prev, paymentId]);
    } else {
      setSelectedPayments(prev => prev.filter(id => id !== paymentId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingPaymentIds = filteredPayments
        .filter(p => p.payment_status === 'pending')
        .map(p => p.id);
      setSelectedPayments(pendingPaymentIds);
    } else {
      setSelectedPayments([]);
    }
  };

  const handleCreatePayment = async (deliveryId: string) => {
    try {
      await createPayment(deliveryId);
      toast({
        title: "Pago creado",
        description: "Se ha creado el registro de pago para la entrega"
      });
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };

  const handleMarkAsPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentId) return;

    try {
      await markAsPaid(selectedPaymentId, paymentFormData);
      setIsPaymentDialogOpen(false);
      setSelectedPaymentId(null);
      setPaymentFormData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: "",
        reference_number: "",
        notes: ""
      });
      toast({
        title: "Pago registrado",
        description: "El pago ha sido marcado como pagado exitosamente"
      });
    } catch (error) {
      console.error('Error marking as paid:', error);
    }
  };

  const handleBulkMarkAsPaid = async () => {
    if (selectedPayments.length === 0) return;

    try {
      for (const paymentId of selectedPayments) {
        await markAsPaid(paymentId, paymentFormData);
      }
      setSelectedPayments([]);
      toast({
        title: "Pagos registrados",
        description: `Se han marcado ${selectedPayments.length} pagos como pagados`
      });
    } catch (error) {
      console.error('Error bulk marking as paid:', error);
    }
  };

  const openPaymentDialog = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setIsPaymentDialogOpen(true);
  };

  const openDeleteDialog = (payment: any) => {
    setPaymentToDelete(payment);
    setIsDeleteDialogOpen(true);
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;

    try {
      await deletePayment(paymentToDelete.id);
      setIsDeleteDialogOpen(false);
      setPaymentToDelete(null);
      toast({
        title: "Pago eliminado",
        description: "El registro de pago ha sido eliminado exitosamente"
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPayments.length === 0) return;

    try {
      for (const paymentId of selectedPayments) {
        await deletePayment(paymentId);
      }
      setSelectedPayments([]);
      toast({
        title: "Pagos eliminados",
        description: `Se han eliminado ${selectedPayments.length} pagos exitosamente`
      });
    } catch (error) {
      console.error('Error bulk deleting payments:', error);
    }
  };

  const pendingPaymentsCount = filteredPayments.filter(p => p.payment_status === 'pending').length;
  const totalPendingAmount = filteredPayments
    .filter(p => p.payment_status === 'pending')
    .reduce((sum, p) => sum + p.net_amount, 0);

  // Calculate total of selected payments
  const selectedPaymentsTotal = useMemo(() => {
    return selectedPayments.reduce((sum, paymentId) => {
      const payment = filteredPayments.find(p => p.id === paymentId);
      return sum + (payment?.net_amount || 0);
    }, 0);
  }, [selectedPayments, filteredPayments]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Cargando pagos...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagos Pendientes</p>
                <p className="text-2xl font-bold">{pendingPaymentsCount}</p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monto Pendiente</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPendingAmount)}</p>
              </div>
              <Calculator className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pagos</p>
                <p className="text-2xl font-bold">{filteredPayments.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Pagos de Entregas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por tracking, orden o taller..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={workshopFilter} onValueChange={setWorkshopFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Taller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los talleres</SelectItem>
                {workshops.map(workshop => (
                  <SelectItem key={workshop} value={workshop}>
                    {workshop}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={refetch} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedPayments.length > 0 && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <div>{selectedPayments.length} pago(s) seleccionado(s)</div>
                  <div className="font-medium text-foreground">Total: {formatCurrency(selectedPaymentsTotal)}</div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleBulkMarkAsPaid}
                    disabled={selectedPayments.length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Marcar como Pagados
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={selectedPayments.length === 0}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar Seleccionados
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedPayments([])}
                  >
                    Limpiar Selección
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Payments Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedPayments.length === filteredPayments.filter(p => p.payment_status === 'pending').length && pendingPaymentsCount > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Taller</TableHead>
                  <TableHead>Unidades</TableHead>
                  <TableHead>Monto Neto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {payment.payment_status === 'pending' && (
                        <Checkbox
                          checked={selectedPayments.includes(payment.id)}
                          onCheckedChange={(checked) => handleSelectPayment(payment.id, checked as boolean)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.tracking_number || '-'}
                    </TableCell>
                    <TableCell>{payment.order_number || '-'}</TableCell>
                    <TableCell>{payment.workshop_name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Total: {payment.total_units}</div>
                        <div className="text-muted-foreground">Facturable: {payment.billable_units}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.net_amount)}
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(payment.payment_status)}
                    </TableCell>
                    <TableCell>
                      {payment.payment_date || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {!payment.delivery_id && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleCreatePayment(payment.delivery_id)}
                          >
                            <Calculator className="w-4 h-4" />
                          </Button>
                        )}
                        {payment.payment_status === 'pending' && (
                          <>
                            <Button 
                              size="sm"
                              onClick={() => openPaymentDialog(payment.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm"
                              variant="destructive"
                              onClick={() => openDeleteDialog(payment)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredPayments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron pagos con los filtros aplicados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>¿Estás seguro de que deseas eliminar este registro de pago?</p>
            {paymentToDelete && (
              <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                <p><strong>Tracking:</strong> {paymentToDelete.tracking_number || 'N/A'}</p>
                <p><strong>Orden:</strong> {paymentToDelete.order_number || 'N/A'}</p>
                <p><strong>Taller:</strong> {paymentToDelete.workshop_name || 'N/A'}</p>
                <p><strong>Monto:</strong> {formatCurrency(paymentToDelete.net_amount)}</p>
                <p><strong>Estado:</strong> {paymentToDelete.payment_status}</p>
              </div>
            )}
            <p className="text-destructive text-sm">Esta acción no se puede deshacer.</p>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDeletePayment}>
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};