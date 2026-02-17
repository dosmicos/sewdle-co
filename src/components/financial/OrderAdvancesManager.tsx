import { useState } from "react";
import { Plus, Edit, Trash2, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useOrderAdvances, OrderAdvanceInsert } from "@/hooks/useOrderAdvances";
import { useWorkshops } from "@/hooks/useWorkshops";
import { useOrders } from "@/hooks/useOrders";
import { WorkshopAdvanceSummary } from "./WorkshopAdvanceSummary";

interface AdvanceFormData {
  order_id: string;
  workshop_id: string;
  amount: string;
  currency: string;
  advance_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
  receipt_url: string;
}

const initialFormData: AdvanceFormData = {
  order_id: "",
  workshop_id: "",
  amount: "",
  currency: "COP",
  advance_date: new Date().toISOString().split('T')[0],
  payment_method: "",
  reference_number: "",
  notes: "",
  receipt_url: ""
};

interface OrderAdvancesManagerProps {
  orderId?: string;
  workshopId?: string;
}

export const OrderAdvancesManager = ({ orderId, workshopId }: OrderAdvancesManagerProps) => {
  const { advances, loading, createAdvance, updateAdvance, deleteAdvance } = useOrderAdvances();
  const { workshops } = useWorkshops();
  const { orders } = useOrders();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<string | null>(null);
  const [formData, setFormData] = useState<AdvanceFormData>(initialFormData);

  // Filter advances based on props
  const filteredAdvances = advances.filter(advance => {
    if (orderId && advance.order_id !== orderId) return false;
    if (workshopId && advance.workshop_id !== workshopId) return false;
    return true;
  });

  // Calculate total advances
  const totalAdvances = filteredAdvances.reduce((sum, advance) => sum + advance.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const advanceData: OrderAdvanceInsert = {
      order_id: formData.order_id,
      workshop_id: formData.workshop_id,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      advance_date: formData.advance_date,
      payment_method: formData.payment_method || undefined,
      reference_number: formData.reference_number || undefined,
      notes: formData.notes || undefined,
      receipt_url: formData.receipt_url || undefined
    };

    try {
      if (editingAdvance) {
        await updateAdvance(editingAdvance, advanceData);
      } else {
        await createAdvance(advanceData);
      }
      setIsDialogOpen(false);
      setEditingAdvance(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving advance:', error);
    }
  };

  const handleEdit = (advance: unknown) => {
    setEditingAdvance(advance.id);
    setFormData({
      order_id: advance.order_id,
      workshop_id: advance.workshop_id,
      amount: advance.amount.toString(),
      currency: advance.currency,
      advance_date: advance.advance_date,
      payment_method: advance.payment_method || "",
      reference_number: advance.reference_number || "",
      notes: advance.notes || "",
      receipt_url: advance.receipt_url || ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdvance(id);
    } catch (error) {
      console.error('Error deleting advance:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `COP $${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  return (
    <div className="space-y-6">
      {!orderId && !workshopId && <WorkshopAdvanceSummary />}
      
      <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Anticipos
            {totalAdvances > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                (Total: {formatCurrency(totalAdvances, "COP")})
              </span>
            )}
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingAdvance(null);
                setFormData({
                  ...initialFormData,
                  order_id: orderId || "",
                  workshop_id: workshopId || ""
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Anticipo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingAdvance ? 'Editar Anticipo' : 'Nuevo Anticipo'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!orderId && (
                  <div>
                    <Label htmlFor="order_id">Orden</Label>
                    <Select
                      value={formData.order_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, order_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar orden" />
                      </SelectTrigger>
                      <SelectContent>
                        {orders.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.order_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!workshopId && (
                  <div>
                    <Label htmlFor="workshop_id">Taller</Label>
                    <Select
                      value={formData.workshop_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, workshop_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar taller" />
                      </SelectTrigger>
                      <SelectContent>
                        {workshops.map((workshop) => (
                          <SelectItem key={workshop.id} value={workshop.id}>
                            {workshop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COP">COP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="advance_date">Fecha del Anticipo</Label>
                  <Input
                    id="advance_date"
                    type="date"
                    value={formData.advance_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, advance_date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="payment_method">Método de Pago</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, payment_method: value }))}
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
                    value={formData.reference_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="Número de referencia"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingAdvance ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Cargando anticipos...</div>
        ) : filteredAdvances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay anticipos registrados
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {!orderId && <TableHead>Orden</TableHead>}
                {!workshopId && <TableHead>Taller</TableHead>}
                <TableHead>Monto</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdvances.map((advance) => (
                <TableRow key={advance.id}>
                  {!orderId && <TableCell>{advance.order_number}</TableCell>}
                  {!workshopId && <TableCell>{advance.workshop_name}</TableCell>}
                  <TableCell>{formatCurrency(advance.amount, advance.currency)}</TableCell>
                  <TableCell>{advance.advance_date}</TableCell>
                  <TableCell className="capitalize">{advance.payment_method}</TableCell>
                  <TableCell>{advance.reference_number}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(advance)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar anticipo?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente este anticipo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(advance.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
    </div>
  );
};