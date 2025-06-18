
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, FileText, Image, CheckCircle } from 'lucide-react';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { useDeliveries } from '@/hooks/useDeliveries';

interface DeliveryFormProps {
  onClose: () => void;
  onDeliveryCreated?: () => void;
}

interface FormData {
  orderId: string;
  workshopId: string;
  products: Record<string, number>;
  general: {
    observations: string;
  };
  files: FileList | null;
}

const DeliveryForm: React.FC<DeliveryFormProps> = ({ onClose, onDeliveryCreated }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    orderId: '',
    workshopId: '',
    products: {},
    general: {
      observations: ''
    },
    files: null
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  
  const { fetchAvailableOrders, loading: ordersLoading } = useDeliveryOrders();
  const { createDelivery, loading: deliveryLoading } = useDeliveries();

  useEffect(() => {
    loadAvailableOrders();
  }, []);

  const loadAvailableOrders = async () => {
    const orders = await fetchAvailableOrders();
    setAvailableOrders(orders);
  };

  const handleOrderSelect = (orderId: string) => {
    const order = availableOrders.find(o => o.id === orderId);
    setSelectedOrder(order || null);
    
    if (order) {
      const workshopId = order.workshop_assignments?.[0]?.workshop_id || '';
      
      setFormData(prev => ({
        ...prev,
        orderId,
        workshopId,
        products: {}
      }));
    }
  };

  const handleVariantChange = (orderItemId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [orderItemId]: numValue
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const invalidFiles = Array.from(files).filter(file => !validTypes.includes(file.type));
      
      if (invalidFiles.length > 0) {
        alert('Solo se permiten archivos JPG, PNG y PDF');
        return;
      }

      const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
      if (totalSize > 100 * 1024 * 1024) {
        alert('El tamaño total de los archivos no puede exceder 100MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        files
      }));
    }
  };

  const handleObservationsChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      general: {
        ...prev.general,
        observations: value
      }
    }));
  };

  const handleSubmit = async () => {
    try {
      const deliveryItems = Object.entries(formData.products)
        .filter(([_, quantity]) => quantity > 0)
        .map(([orderItemId, quantity]) => ({
          orderItemId,
          quantityDelivered: quantity
        }));

      if (deliveryItems.length === 0) {
        alert('Debe especificar al menos una cantidad a entregar');
        return;
      }

      const deliveryData = {
        orderId: formData.orderId,
        workshopId: formData.workshopId,
        notes: formData.general.observations,
        items: deliveryItems
      };

      await createDelivery(deliveryData);
      
      if (onDeliveryCreated) {
        onDeliveryCreated();
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating delivery:', error);
    }
  };

  const getTotalDelivered = () => {
    return Object.values(formData.products).reduce((total: number, quantity) => total + quantity, 0);
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.orderId !== '';
      case 2:
        return getTotalDelivered() > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="order">Seleccionar Orden</Label>
              <Select value={formData.orderId} onValueChange={handleOrderSelect} disabled={ordersLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={ordersLoading ? "Cargando órdenes..." : "Seleccione una orden..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} - {order.workshop_assignments?.[0]?.workshops?.name || 'Sin taller'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedOrder && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Items en la orden:</h4>
                <div className="space-y-3">
                  {selectedOrder.order_items?.map((item: any) => (
                    <div key={item.id} className="border-l-4 border-blue-500 pl-3">
                      <h5 className="font-medium">{item.product_variants?.products?.name}</h5>
                      <div className="text-sm text-gray-600">
                        <span>Variante: {item.product_variants?.size} - {item.product_variants?.color}</span>
                        <br />
                        <span className="font-medium">Cantidad: {item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="font-medium text-lg">Cantidades a Entregar</h3>
            {selectedOrder && selectedOrder.order_items && (
              <div className="space-y-4">
                {selectedOrder.order_items.map((item: any) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold">{item.product_variants?.products?.name}</h4>
                        <p className="text-sm text-gray-600">
                          {item.product_variants?.size} - {item.product_variants?.color}
                        </p>
                      </div>
                      <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Disponible: {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Label htmlFor={`quantity-${item.id}`}>Cantidad a entregar:</Label>
                      <Input
                        id={`quantity-${item.id}`}
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={formData.products[item.id] || 0}
                        onChange={(e) => handleVariantChange(item.id, e.target.value)}
                        placeholder="0"
                        className="w-24"
                      />
                    </div>
                  </div>
                ))}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-blue-800">Total a Entregar:</span>
                    <span className="text-2xl font-bold text-blue-900">{getTotalDelivered()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                placeholder="Comentarios adicionales sobre la entrega..."
                value={formData.general.observations}
                onChange={(e) => handleObservationsChange(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="files">Adjuntar Archivos</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Arrastra archivos aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  JPG, PNG, PDF (máx. 5 archivos, 100MB total)
                </p>
                <input
                  type="file"
                  id="files"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('files')?.click()}
                >
                  Seleccionar Archivos
                </Button>
              </div>
              {formData.files && formData.files.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium mb-2">Archivos seleccionados:</p>
                  {Array.from(formData.files).map((file, index) => (
                    <div key={index} className="flex items-center text-sm text-gray-600">
                      {file.type.startsWith('image/') ? <Image className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium">Confirmar Entrega</h3>
              <p className="text-gray-600">Revisa los datos antes de enviar</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Orden: {selectedOrder?.order_number}</h4>
                <div className="space-y-3">
                  {selectedOrder?.order_items?.map((item: any) => {
                    const quantity = formData.products[item.id];
                    if (!quantity || quantity === 0) return null;
                    
                    return (
                      <div key={item.id} className="border-l-4 border-blue-500 pl-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="font-medium">{item.product_variants?.products?.name}</h5>
                            <p className="text-sm text-gray-600">
                              {item.product_variants?.size} - {item.product_variants?.color}
                            </p>
                          </div>
                          <span className="font-semibold text-blue-700">{quantity} unidades</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total General:</span>
                    <span className="text-blue-700">{getTotalDelivered()} unidades</span>
                  </div>
                </div>
              </div>

              {formData.general.observations && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Observaciones:</h4>
                  <p className="text-sm text-gray-700">{formData.general.observations}</p>
                </div>
              )}

              {formData.files && formData.files.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Archivos adjuntos:</h4>
                  <div className="space-y-1">
                    {Array.from(formData.files).map((file, index) => (
                      <div key={index} className="flex items-center text-sm text-gray-600">
                        {file.type.startsWith('image/') ? <Image className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                        {file.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Registrar Entrega</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step <= currentStep ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-1 rounded ml-4 ${
                    step < currentStep ? 'bg-blue-500' : 'bg-gray-200'
                  }`} style={{ width: '60px' }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Seleccionar Orden</span>
            <span>Cantidades</span>
            <span>Confirmar</span>
          </div>
        </div>

        <div className="p-6">
          {renderStepContent()}
        </div>

        <div className="flex items-center justify-between p-6 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Anterior
          </Button>
          
          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!isStepValid(currentStep)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!isStepValid(currentStep) || deliveryLoading}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {deliveryLoading ? 'Registrando...' : 'Registrar Entrega'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DeliveryForm;
