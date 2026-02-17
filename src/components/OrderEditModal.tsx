
import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOrderActions } from '@/hooks/useOrderActions';
import { useUserContext } from '@/hooks/useUserContext';
import OrderQuantityEditor from './OrderQuantityEditor';
import ProductSelector from './ProductSelector';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';
import { Settings, Package, AlertTriangle, Plus, Wrench, Truck, FileText, RefreshCw } from 'lucide-react';
import MaterialConsumptionForm from './supplies/MaterialConsumptionForm';
import OrderFileManager from './OrderFileManager';
import { useWorkshopAssignments } from '@/hooks/useWorkshopAssignments';
import { useWorkshops } from '@/hooks/useWorkshops';
import { WorkshopReassignmentDialog } from './WorkshopReassignmentDialog';

interface OrderEditModalProps {
  order: unknown;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OrderEditModal = ({ order, open, onClose, onSuccess }: OrderEditModalProps) => {
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [selectedProducts, setSelectedProducts] = useState<unknown[]>([]);
  const [orderWorkshopId, setOrderWorkshopId] = useState<string>('');
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>('');
  const [showMaterialConsumption, setShowMaterialConsumption] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const { updateOrder, updateOrderItemQuantities, updateOrderItemsWithDeletions, addProductsToOrder, loading } = useOrderActions();
  const { isAdmin, isDesigner } = useUserContext();
  const { createAssignment, loading: assignmentLoading } = useWorkshopAssignments(false);
  const { workshops } = useWorkshops();

  const canEditQuantities = isAdmin || isDesigner;

  const fetchOrderWorkshop = useCallback(async () => {
    if (!order?.id) return;
    
    try {
      // Buscar la asignación de taller para esta orden
      const { data, error } = await supabase
        .from('workshop_assignments')
        .select('workshop_id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching workshop assignment:', error);
        return;
      }

      if (data?.workshop_id) {
        setOrderWorkshopId(data.workshop_id);
      }
    } catch (error) {
      console.error('Error fetching order workshop:', error);
    }
  }, [order?.id]);

  useEffect(() => {
    if (order) {
      setDueDate(order.due_date || '');
      setNotes(order.notes || '');
      setStatus(order.status || 'pending');
      setActiveTab('details'); // Reset to details tab when order changes
      setSelectedProducts([]); // Reset selected products
      
      // Obtener el workshop_id de la orden
      fetchOrderWorkshop();
    }
  }, [order, fetchOrderWorkshop]);



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

  const handleQuantitiesSave = async (
    updatedItems: { id: string; quantity: number; total_price: number }[],
    deletedItemIds: string[] = []
  ) => {
    const success = await updateOrderItemsWithDeletions(order.id, updatedItems, deletedItemIds);
    if (success) {
      onSuccess();
      return true;
    }
    return false;
  };

  const handleAddProducts = async () => {
    if (selectedProducts.length === 0) {
      return;
    }

    const success = await addProductsToOrder(order.id, selectedProducts);
    if (success) {
      setSelectedProducts([]);
      onSuccess();
      setActiveTab('details'); // Switch back to details tab
    }
  };

  const handleProductsChange = (products: unknown[]) => {
    setSelectedProducts(products);
  };

  const getTotalProductsToAdd = () => {
    return selectedProducts.reduce((total, product) => total + product.quantity, 0);
  };


  const handleWorkshopAssignment = async () => {
    if (!selectedWorkshopId) return;

    const assignmentData = {
      order_id: order.id,
      workshop_id: selectedWorkshopId,
      expected_completion_date: dueDate || null, // Usar la fecha de entrega del formulario principal
      notes: null, // Sin notas de asignación
      status: 'assigned' as const
    };

    const result = await createAssignment(assignmentData);
    if (result.data) {
      setOrderWorkshopId(selectedWorkshopId);
      setSelectedWorkshopId('');
      onSuccess(); // Actualizar la orden en la lista
    }
  };

  const getAssignedWorkshop = () => {
    return workshops.find(workshop => workshop.id === orderWorkshopId);
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Detalles</span>
            </TabsTrigger>
            <TabsTrigger value="quantities" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Cantidades</span>
            </TabsTrigger>
            <TabsTrigger value="add-products" className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Agregar Productos</span>
            </TabsTrigger>
            <TabsTrigger value="consume-materials" className="flex items-center space-x-2">
              <Truck className="w-4 h-4" />
              <span>Materiales</span>
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Archivos</span>
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

              {/* Sección de asignación de taller */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Asignación de Taller</h3>
                
                {orderWorkshopId ? (
                  // Mostrar taller asignado
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Wrench className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium text-green-900">Taller Asignado</h4>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReassignDialog(true)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Cambiar Taller
                      </Button>
                    </div>
                    <p className="text-green-700">
                      <strong>{getAssignedWorkshop()?.name || 'Taller no encontrado'}</strong>
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Esta orden está asignada al taller seleccionado
                    </p>
                  </div>
                ) : (
                  // Formulario de asignación
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-blue-600" />
                      <h4 className="font-medium text-blue-900">Asignar Taller a la Orden</h4>
                    </div>
                    <p className="text-sm text-blue-700 mb-4">
                      Esta orden no está asignada a ningún taller. Selecciona un taller para comenzar la producción.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="workshopSelect">Taller</Label>
                        <Select value={selectedWorkshopId} onValueChange={setSelectedWorkshopId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar taller" />
                          </SelectTrigger>
                          <SelectContent>
                            {workshops
                              .filter(workshop => workshop.status === 'active')
                              .map((workshop) => (
                              <SelectItem key={workshop.id} value={workshop.id}>
                                {workshop.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleWorkshopAssignment}
                          disabled={assignmentLoading || !selectedWorkshopId}
                          className="bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          {assignmentLoading ? 'Asignando...' : 'Asignar Taller'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
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

          <TabsContent value="add-products" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Agregar productos a la orden</h4>
                <p className="text-sm text-blue-700">
                  Selecciona los productos y cantidades que deseas agregar a esta orden de producción.
                </p>
              </div>

              <ProductSelector
                selectedProducts={selectedProducts}
                onProductsChange={handleProductsChange}
              />

              {selectedProducts.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Resumen de productos a agregar</h4>
                  <p className="text-sm text-green-700">
                    Se agregarán {getTotalProductsToAdd()} unidades en total ({selectedProducts.length} productos diferentes)
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('details')}
                  disabled={loading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddProducts}
                  disabled={loading || selectedProducts.length === 0}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  {loading ? 'Agregando...' : `Agregar ${selectedProducts.length} Productos`}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="consume-materials" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">Materiales</h4>
                <p className="text-sm text-red-700">
                  Registra los materiales que fueron consumidos durante la producción de esta orden.
                </p>
              </div>

              {orderWorkshopId ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-green-900">Orden asignada al taller</h4>
                      <p className="text-sm text-green-700">
                        Taller: <strong>{getAssignedWorkshop()?.name || 'Taller no encontrado'}</strong>
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Los materiales se consumirán del stock de este taller
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowMaterialConsumption(true)}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      <Truck className="w-4 h-4 mr-2" />
                      Consumir Materiales
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2">Orden sin taller asignado</h4>
                  <p className="text-sm text-yellow-700">
                    Esta orden debe estar asignada a un taller antes de poder consumir materiales.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="files" className="space-y-6 mt-6">
            <OrderFileManager 
              orderId={order.id}
              orderFiles={order.order_files || []}
              onFilesUpdated={onSuccess}
              editable={true}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
      

      {/* Modal para consumir materiales */}
      {showMaterialConsumption && orderWorkshopId && (
        <MaterialConsumptionForm
          orderId={order.id}
          orderNumber={order.order_number}
          workshopId={orderWorkshopId}
          onClose={() => setShowMaterialConsumption(false)}
          onConsumptionCompleted={() => {
            setShowMaterialConsumption(false);
            onSuccess(); // Actualizar los datos de la orden
          }}
        />
      )}

      {/* Dialog de reasignación de taller */}
      {orderWorkshopId && order.workshop_assignments && order.workshop_assignments.length > 0 && (
        <WorkshopReassignmentDialog
          open={showReassignDialog}
          onClose={() => setShowReassignDialog(false)}
          orderId={order.id}
          orderNumber={order.order_number}
          currentAssignment={{
            id: order.workshop_assignments[0].id,
            workshop_id: orderWorkshopId,
            workshop_name: getAssignedWorkshop()?.name || 'Taller no encontrado'
          }}
          onSuccess={() => {
            setShowReassignDialog(false);
            fetchOrderWorkshop();
            onSuccess();
          }}
        />
      )}
    </Dialog>
  );
};

export default OrderEditModal;
