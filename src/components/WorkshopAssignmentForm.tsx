
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWorkshopAssignments } from '@/hooks/useWorkshopAssignments';
import { useWorkshops } from '@/hooks/useWorkshops';

interface WorkshopAssignmentFormProps {
  open: boolean;
  onClose: () => void;
  orderId?: string;
}

interface AvailableOrder {
  id: string;
  order_number: string;
  client_name: string;
  due_date: string | null;
  total_amount: number | null;
  status: string | null;
  created_at: string;
}

const WorkshopAssignmentForm: React.FC<WorkshopAssignmentFormProps> = ({
  open,
  onClose,
  orderId
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState(orderId || '');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [availableOrders, setAvailableOrders] = useState<AvailableOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const { createAssignment, getAvailableOrders } = useWorkshopAssignments();
  const { workshops } = useWorkshops();

  useEffect(() => {
    if (open) {
      loadAvailableOrders();
      if (orderId) {
        setSelectedOrderId(orderId);
      }
    }
  }, [open, orderId]);

  const loadAvailableOrders = async () => {
    const orders = await getAvailableOrders();
    setAvailableOrders(orders);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId || !selectedWorkshopId) return;

    setLoading(true);
    const result = await createAssignment({
      order_id: selectedOrderId,
      workshop_id: selectedWorkshopId,
      expected_completion_date: expectedDate || null,
      notes: notes || null
    });

    if (result.data) {
      onClose();
      setSelectedOrderId('');
      setSelectedWorkshopId('');
      setExpectedDate('');
      setNotes('');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Orden a Taller</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="order">Orden de Producción</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar orden..." />
              </SelectTrigger>
              <SelectContent>
                {availableOrders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.order_number} - {order.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="workshop">Taller</Label>
            <Select value={selectedWorkshopId} onValueChange={setSelectedWorkshopId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar taller..." />
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

          <div>
            <Label htmlFor="expectedDate">Fecha Esperada de Entrega</Label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !selectedOrderId || !selectedWorkshopId}
              className="flex-1"
            >
              {loading ? 'Asignando...' : 'Asignar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkshopAssignmentForm;
