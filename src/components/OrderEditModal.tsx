
import React, { useState, useEffect } from 'react';
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
import { Settings, Package, AlertTriangle, Plus, Wrench, Truck } from 'lucide-react';
import WorkshopMaterialSelector from './WorkshopMaterialSelector';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';
import MaterialDeliveryForm from './supplies/MaterialDeliveryForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMaterials } from '@/hooks/useMaterials';

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
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<any[]>([]);
  const [orderWorkshopId, setOrderWorkshopId] = useState<string>('');
  const [workshopStock, setWorkshopStock] = useState<Record<string, number>>({});
  const [missingMaterials, setMissingMaterials] = useState<any[]>([]);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const { updateOrder, updateOrderItemQuantities, addProductsToOrder, loading } = useOrderActions();
  const { consumeOrderMaterials, loading: consumingMaterials } = useMaterialConsumption();
  const { isAdmin, isDesigner } = useUserContext();
  const { materialDeliveries, fetchMaterialDeliveries } = useMaterialDeliveries();
  const { materials } = useMaterials();

  const canEditQuantities = isAdmin || isDesigner;

  useEffect(() => {
    if (order) {
      setDueDate(order.due_date || '');
      setNotes(order.notes || '');
      setStatus(order.status || 'pending');
      setActiveTab('details'); // Reset to details tab when order changes
      setSelectedProducts([]); // Reset selected products
      setSelectedMaterials([]); // Reset selected materials
      
      // Obtener el workshop_id de la orden
      fetchOrderWorkshop();
    }
  }, [order]);

  useEffect(() => {
    if (orderWorkshopId) {
      loadWorkshopStock();
    }
  }, [orderWorkshopId]);

  useEffect(() => {
    if (orderWorkshopId && selectedMaterials.length > 0) {
      checkMaterialAvailability();
    }
  }, [selectedMaterials, workshopStock, orderWorkshopId]);

  const fetchOrderWorkshop = async () => {
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
  };

  const loadWorkshopStock = async () => {
    if (!orderWorkshopId) return;
    
    try {
      await fetchMaterialDeliveries();
      const stock: Record<string, number> = {};
      
      // Calcular stock disponible por material en el taller seleccionado usando el nuevo campo real_balance
      materialDeliveries
        .filter(delivery => delivery.workshop_id === orderWorkshopId)
        .forEach(delivery => {
          const materialId = delivery.material_id;
          const available = delivery.real_balance || 0;
          stock[materialId] = (stock[materialId] || 0) + available;
        });
      
      setWorkshopStock(stock);
    } catch (error) {
      console.error('Error loading workshop stock:', error);
    }
  };

  const checkMaterialAvailability = () => {
    const missing: any[] = [];
    
    selectedMaterials.forEach(material => {
      const availableStock = workshopStock[material.id] || 0;
      if (availableStock < material.quantity) {
        missing.push({
          ...material,
          missingQuantity: material.quantity - availableStock
        });
      }
    });
    
    setMissingMaterials(missing);
  };

  const handleCreateDeliveryForMissing = () => {
    setShowDeliveryForm(true);
  };

  const handleDeliverySuccess = () => {
    setShowDeliveryForm(false);
    loadWorkshopStock(); // Recargar stock después de crear entrega
  };

  const formatMaterialDisplayName = (material: any) => {
    const baseName = `${material.name} (${material.sku})`;
    return material.color ? `${baseName} - ${material.color}` : baseName;
  };

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

  const handleProductsChange = (products: any[]) => {
    setSelectedProducts(products);
  };

  const getTotalProductsToAdd = () => {
    return selectedProducts.reduce((total, product) => total + product.quantity, 0);
  };

  const handleAddMaterials = async () => {
    if (selectedMaterials.length === 0) {
      return;
    }

    const consumptions = selectedMaterials.map(material => ({
      material_id: material.id,
      quantity: material.quantity
    }));

    const success = await consumeOrderMaterials(order.id, consumptions);
    if (success) {
      setSelectedMaterials([]);
      onSuccess();
      setActiveTab('details'); // Switch back to details tab
    }
  };

  const handleMaterialsChange = (materials: any[]) => {
    setSelectedMaterials(materials);
  };

  const getTotalMaterialsToAdd = () => {
    return selectedMaterials.reduce((total, material) => total + material.quantity, 0);
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Información General</span>
            </TabsTrigger>
            <TabsTrigger value="quantities" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Cantidades de Producción</span>
            </TabsTrigger>
            <TabsTrigger value="add-products" className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Agregar Productos</span>
            </TabsTrigger>
            <TabsTrigger value="add-materials" className="flex items-center space-x-2">
              <Wrench className="w-4 h-4" />
              <span>Agregar Materiales</span>
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

          <TabsContent value="add-materials" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h4 className="font-medium text-orange-900 mb-2">Registrar consumo de materiales</h4>
                <p className="text-sm text-orange-700">
                  Selecciona los materiales que se consumieron durante la producción de esta orden.
                </p>
              </div>

              {/* Alertas de materiales faltantes */}
              {orderWorkshopId && missingMaterials.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>Materiales insuficientes en el taller:</strong>
                        <ul className="mt-1 text-sm">
                          {missingMaterials.map((material, index) => {
                            const mat = materials.find(m => m.id === material.id);
                            return (
                              <li key={index}>
                                • {formatMaterialDisplayName(mat)}: faltan {material.missingQuantity} {mat?.unit}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <Button
                        type="button"
                        onClick={handleCreateDeliveryForMissing}
                        size="sm"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        Crear Entrega
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {orderWorkshopId ? (
                <WorkshopMaterialSelector
                  workshopId={orderWorkshopId}
                  selectedMaterials={selectedMaterials}
                  onMaterialsChange={setSelectedMaterials}
                />
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2">Orden sin taller asignado</h4>
                  <p className="text-sm text-yellow-700">
                    Esta orden no tiene un taller asignado. Para agregar materiales, primero debe asignarse a un taller.
                  </p>
                </div>
              )}

              {selectedMaterials.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">Resumen de materiales a consumir</h4>
                  <p className="text-sm text-green-700">
                    Se consumirán {getTotalMaterialsToAdd()} unidades en total ({selectedMaterials.length} materiales diferentes)
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab('details')}
                  disabled={consumingMaterials}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddMaterials}
                  disabled={consumingMaterials || selectedMaterials.length === 0 || missingMaterials.length > 0}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {consumingMaterials ? 'Registrando...' : `Registrar ${selectedMaterials.length} Materiales`}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      
      {/* Modal para crear entrega de materiales */}
      {showDeliveryForm && orderWorkshopId && (
        <MaterialDeliveryForm
          onClose={() => setShowDeliveryForm(false)}
          onDeliveryCreated={handleDeliverySuccess}
          prefilledData={{
            workshopId: orderWorkshopId,
            materials: missingMaterials.map(material => ({
              materialId: material.id,
              quantity: material.missingQuantity,
              unit: materials.find(m => m.id === material.id)?.unit || '',
              notes: `Entrega para orden ${order.order_number}`
            }))
          }}
        />
      )}
    </Dialog>
  );
};

export default OrderEditModal;
