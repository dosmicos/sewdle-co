import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Trash2 } from 'lucide-react';
import ProductSelector from '@/components/ProductSelector';
import SuppliesManager from '@/components/SuppliesManager';
import OrderMaterialAlert from '@/components/OrderMaterialAlert';
import MaterialDeliveryForm from '@/components/supplies/MaterialDeliveryForm';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrders } from '@/hooks/useOrders';
import { useOrderMaterialValidation } from '@/hooks/useOrderMaterialValidation';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';

interface OrderFormProps {
  onClose: () => void;
}

const OrderForm = ({ onClose }: OrderFormProps) => {
  const [selectedWorkshop, setSelectedWorkshop] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [cuttingOrderFile, setCuttingOrderFile] = useState<File | null>(null);
  
  // Estados para manejo de diálogos
  const [showOrderForm, setShowOrderForm] = useState(true);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [pendingMissingMaterials, setPendingMissingMaterials] = useState<any[]>([]);

  // Estados para validación de materiales
  const [materialValidation, setMaterialValidation] = useState<any>(null);
  const [showMaterialValidation, setShowMaterialValidation] = useState(false);

  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { createOrder, loading: creatingOrder } = useOrders();
  const { validateMaterialsForWorkshop, loading: validatingMaterials } = useOrderMaterialValidation();
  const { consumeOrderMaterials } = useMaterialConsumption();

  // Validar materiales cuando cambien los insumos o el taller
  useEffect(() => {
    if (selectedWorkshop && supplies.length > 0) {
      handleMaterialValidation();
    } else {
      setMaterialValidation(null);
      setShowMaterialValidation(false);
    }
  }, [selectedWorkshop, supplies]);

  const handleMaterialValidation = async () => {
    if (!selectedWorkshop || supplies.length === 0) return;

    const validSupplies = supplies.filter(supply => 
      supply.materialId && supply.quantity > 0
    );

    if (validSupplies.length === 0) return;

    const materialRequirements = validSupplies.map(supply => ({
      materialId: supply.materialId,
      quantity: Number(supply.quantity),
      unit: supply.unit
    }));

    const validation = await validateMaterialsForWorkshop(selectedWorkshop, materialRequirements);
    setMaterialValidation(validation);
    setShowMaterialValidation(true);
  };

  const handleCreateDelivery = (missingMaterials?: any[]) => {
    console.log('OrderForm: handleCreateDelivery called');
    const materialsToDeliver = missingMaterials || materialValidation?.insufficientMaterials || [];
    setPendingMissingMaterials(materialsToDeliver);
    
    // Solo abrir el modal de entrega sin cerrar el formulario principal
    setShowDeliveryForm(true);
  };

  const handleDeliveryCreated = async () => {
    console.log('OrderForm: handleDeliveryCreated called');
    setShowDeliveryForm(false);
    setPendingMissingMaterials([]);
    
    // Re-validar materiales después de crear entrega
    if (selectedWorkshop && supplies.length > 0) {
      await handleMaterialValidation();
    }
  };

  const handleDeliveryFormClose = () => {
    console.log('OrderForm: handleDeliveryFormClose called');
    setShowDeliveryForm(false);
    setPendingMissingMaterials([]);
  };

  const handleOrderFormClose = () => {
    console.log('OrderForm: handleOrderFormClose called');
    setShowOrderForm(false);
    onClose();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCuttingOrderFile(file);
    }
  };

  const removeFile = () => {
    setCuttingOrderFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkshop) {
      alert('Por favor selecciona un taller');
      return;
    }

    console.log('Products data before submit:', selectedProducts);
    console.log('Supplies data before submit:', supplies);

    // Validar que los productos tengan variantId válido
    const validProducts = selectedProducts.filter(product => 
      product.variantId && 
      product.variantId !== 'undefined' && 
      product.quantity && 
      product.quantity > 0
    );

    // Validar que los insumos tengan materialId válido
    const validSupplies = supplies.filter(supply => 
      supply.materialId && 
      supply.materialId !== '' && 
      supply.quantity && 
      supply.quantity > 0
    );

    if (validProducts.length === 0 && validSupplies.length === 0) {
      alert('Debe agregar al menos un producto o insumo a la orden');
      return;
    }

    try {
      const orderData = {
        workshopId: selectedWorkshop,
        dueDate: dueDate || undefined,
        products: validProducts.map(product => ({
          productId: product.productId,
          variantId: product.variantId,
          quantity: Number(product.quantity),
          unitPrice: Number(product.unitPrice) || 0
        })),
        supplies: validSupplies.map(supply => ({
          materialId: supply.materialId,
          quantity: Number(supply.quantity),
          unit: supply.unit,
          notes: supply.notes || undefined
        })),
        notes: notes.trim() || undefined,
        cuttingOrderFile: cuttingOrderFile || undefined,
        materialValidation: materialValidation
      };

      console.log('Final order data to send:', orderData);
      const createdOrder = await createOrder(orderData);
      
      // Si hay validación de materiales y materiales suficientes, consumir automáticamente
      if (materialValidation && 
          materialValidation.sufficientMaterials && 
          materialValidation.sufficientMaterials.length > 0 &&
          createdOrder) {
        
        console.log('Auto-consuming materials for order:', createdOrder.id);
        
        try {
          const consumptionData = materialValidation.sufficientMaterials.map(material => ({
            material_id: material.materialId,
            quantity: material.quantity
          }));
          
          await consumeOrderMaterials(createdOrder.id, consumptionData);
          console.log('Materials consumed automatically');
        } catch (consumptionError) {
          console.error('Error consuming materials automatically:', consumptionError);
          // No bloquear la creación de la orden si falla el consumo
        }
      }
      
      handleOrderFormClose();
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  return (
    <>
      {/* Formulario Principal de Orden */}
      {showOrderForm && (
        <Dialog open={true} onOpenChange={handleOrderFormClose}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-black">
                Nueva Orden de Producción
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información General */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Información General</h3>
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
                </div>
              </Card>

              {/* Selección de Taller */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Taller Asignado</h3>
                <Select value={selectedWorkshop} onValueChange={setSelectedWorkshop} disabled={workshopsLoading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={workshopsLoading ? "Cargando talleres..." : "Seleccionar taller..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {workshops.map((workshop) => (
                      <SelectItem key={workshop.id} value={workshop.id}>
                        {workshop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workshops.length === 0 && !workshopsLoading && (
                  <p className="text-sm text-gray-500 mt-2">
                    No hay talleres disponibles. Crea un taller primero en la sección de Talleres.
                  </p>
                )}
              </Card>

              {/* Módulo de Productos */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Productos</h3>
                <ProductSelector 
                  selectedProducts={selectedProducts}
                  onProductsChange={setSelectedProducts}
                />
                {selectedProducts.length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Productos seleccionados:</h4>
                    {selectedProducts.map((product, index) => (
                      <div key={index} className="text-sm text-blue-800">
                        Producto ID: {product.productId}, Variante: {product.variantId}, Cantidad: {product.quantity}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Módulo de Insumos */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Insumos Necesarios</h3>
                <SuppliesManager 
                  supplies={supplies}
                  onSuppliesChange={setSupplies}
                  selectedWorkshop={selectedWorkshop}
                  onCreateDelivery={handleCreateDelivery}
                />
              </Card>

              {/* Validación de Materiales */}
              {showMaterialValidation && materialValidation && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-black">Estado de Materiales</h3>
                  {validatingMaterials ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600">Validando disponibilidad de materiales...</p>
                    </div>
                  ) : (
                    <OrderMaterialAlert
                      sufficientMaterials={materialValidation.sufficientMaterials}
                      insufficientMaterials={materialValidation.insufficientMaterials}
                      workshopStock={materialValidation.workshopStock}
                      onCreateDelivery={() => handleCreateDelivery()}
                      onProceedAnyway={() => {/* Se puede proceder de todas formas */}}
                    />
                  )}
                </Card>
              )}

              {/* Subida de Archivo */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Orden de Corte</h3>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      id="cutting-order"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xlsx,.xls"
                      onChange={handleFileUpload}
                    />
                    <label
                      htmlFor="cutting-order"
                      className="cursor-pointer flex flex-col items-center space-y-2"
                    >
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Haz clic para subir archivo o arrastra aquí
                      </span>
                      <span className="text-xs text-gray-500">
                        PDF, DOC, DOCX, XLS, XLSX
                      </span>
                    </label>
                  </div>
                  
                  {cuttingOrderFile && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-black">{cuttingOrderFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Notas */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-black">Notas</h3>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escribe aquí las notas especiales para esta orden de producción..."
                  className="min-h-[100px]"
                />
              </Card>

              {/* Botones de Acción */}
              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOrderFormClose}
                  className="px-6"
                  disabled={creatingOrder}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6"
                  disabled={creatingOrder}
                >
                  {creatingOrder ? 'Creando...' : 'Crear Orden'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Entrega de Materiales */}
      {showDeliveryForm && (
        <MaterialDeliveryForm
          onClose={handleDeliveryFormClose}
          onDeliveryCreated={handleDeliveryCreated}
          prefilledData={{
            workshopId: selectedWorkshop,
            materials: pendingMissingMaterials.map(material => ({
              materialId: material.materialId,
              quantity: material.quantity,
              unit: material.unit,
              notes: `Requerido para nueva orden de producción`
            }))
          }}
        />
      )}
    </>
  );
};

export default OrderForm;
