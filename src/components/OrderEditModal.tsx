
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useUserContext } from '@/hooks/useUserContext';
import OrderQuantityEditor from './OrderQuantityEditor';
import { Settings, Package, AlertTriangle } from 'lucide-react';

interface OrderEditModalProps {
  order: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OrderEditModal = ({ order, open, onClose, onSuccess }: OrderEditModalProps) => {
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const { updateOrder, updateOrderItemQuantities, loading } = useOrderActions();
  const { isAdmin, isDesigner } = useUserContext();

  const canEditQuantities = isAdmin || isDesigner;

  useEffect(() => {
    if (order) {
      setDueDate(order.due_date || '');
      setNotes(order.notes || '');
      setStatus(order.status || 'pending');
      setActiveTab('details'); // Reset to details tab when order changes
    }
  }, [order]);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates = {
      due_date: dueDate || null,
      notes: notes.trim() || null,
      status
    };

    const success = await updateOrder(order.id, updates);
    if (success) {
      onSuccess();
      onClose();
    }
  };

  const handleQuantitiesSave = async (updatedItems: { id: string; quantity: number; total_price: number }[]) => {
    const success = await updateOrderItemQuantities(order.id, updatedItems);
    if (success) {
      onSuccess();
      return true;
    }
    return false;
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-black">
            Editar Orden {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Información General</span>
            </TabsTrigger>
            <TabsTrigger value="quantities" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Cantidades de Producción</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6 mt-6">
            <form onSubmit={handleGeneralSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fecha de Entrega</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="assigned">Asignada</SelectItem>
                      <SelectItem value="in_progress">En Progreso</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales sobre la orden..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="quantities" className="space-y-6 mt-6">
            {canEditQuantities ? (
              <>
                {order.order_items && order.order_items.length > 0 ? (
                  <OrderQuantityEditor
                    orderItems={order.order_items}
                    onSave={handleQuantitiesSave}
                    onCancel={() => setActiveTab('details')}
                    loading={loading}
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-2" />
                    <p>Esta orden no tiene productos para editar</p>
                    <p className="text-sm mt-2">Agrega productos a la orden para poder editar sus cantidades</p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-amber-500" />
                <p className="font-medium">Acceso restringido</p>
                <p className="text-sm mt-2">Solo los administradores y diseñadores pueden editar las cantidades de producción</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default OrderEditModal;
