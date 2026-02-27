
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, FileText, Image, CheckCircle, AlertCircle, Trash2, Package } from 'lucide-react';
import { useDeliveryOrders } from '@/hooks/useDeliveryOrders';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useOrderDeliveryStats } from '@/hooks/useOrderDeliveryStats';
import { Badge } from '@/components/ui/badge';

interface DeliveryFormProps {
  onClose: () => void;
  onDeliveryCreated?: () => void;
  preselectedOrderId?: string;
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

interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

const DeliveryForm: React.FC<DeliveryFormProps> = ({ onClose, onDeliveryCreated, preselectedOrderId }) => {
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
  const [variantsBreakdown, setVariantsBreakdown] = useState<any[]>([]);
  const [fileUploadStatus, setFileUploadStatus] = useState<FileUploadStatus[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  const { fetchAvailableOrders, loading: ordersLoading } = useDeliveryOrders();
  const { createDelivery, loading: deliveryLoading } = useDeliveries();
  const { getOrderVariantsBreakdown } = useOrderDeliveryStats();

  useEffect(() => {
    loadAvailableOrders();
  }, []);

  useEffect(() => {
    if (preselectedOrderId && availableOrders.length > 0) {
      handleOrderSelect(preselectedOrderId);
    }
  }, [preselectedOrderId, availableOrders]);

  const loadAvailableOrders = async () => {
    const orders = await fetchAvailableOrders();
    console.log('Available orders loaded:', orders);
    setAvailableOrders(orders);
  };

  const handleOrderSelect = async (orderId: string) => {
    const order = availableOrders.find(o => o.id === orderId);
    setSelectedOrder(order || null);
    
    if (order) {
      const workshopId = order.workshop_assignments?.[0]?.workshop_id || null;
      
      setFormData(prev => ({
        ...prev,
        orderId,
        workshopId: workshopId || '',
        products: {}
      }));

      const variants = await getOrderVariantsBreakdown(orderId);
      setVariantsBreakdown(variants);
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
        alert('Solo se permiten archivos JPG, PNG y PDF para la cuenta de cobro/remisión');
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

      // Initialize upload status for each file
      const statusArray: FileUploadStatus[] = Array.from(files).map(file => ({
        file,
        status: 'pending'
      }));
      setFileUploadStatus(statusArray);
    }
  };

  const removeFile = (index: number) => {
    if (formData.files) {
      const dt = new DataTransfer();
      const files = Array.from(formData.files);
      files.splice(index, 1);
      
      files.forEach(file => dt.items.add(file));
      
      setFormData(prev => ({
        ...prev,
        files: dt.files
      }));

      const newStatus = [...fileUploadStatus];
      newStatus.splice(index, 1);
      setFileUploadStatus(newStatus);
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
      console.log('Form data before processing:', formData);

      if (!formData.orderId) {
        alert('Debe seleccionar una orden');
        return;
      }

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

      // Update file upload status to indicate start of upload
      if (formData.files && formData.files.length > 0) {
        setIsUploadingFiles(true);
        setFileUploadStatus(prev => 
          prev.map(status => ({ ...status, status: 'uploading' as const }))
        );
      }

      const deliveryData = {
        orderId: formData.orderId,
        workshopId: formData.workshopId || null,
        notes: formData.general.observations.trim() || null,
        items: deliveryItems,
        files: formData.files ? Array.from(formData.files) : undefined
      };

      console.log('Sending delivery data with invoice/remission files:', deliveryData);

      const result = await createDelivery(deliveryData);
      
      // Update file status based on result
      if (formData.files && formData.files.length > 0) {
        setFileUploadStatus(prev => 
          prev.map(status => ({ ...status, status: 'success' as const }))
        );
        console.log(`Archivos de cuenta de cobro/remisión guardados exitosamente para entrega ${result.tracking_number}`);
      }

      if (onDeliveryCreated) {
        onDeliveryCreated();
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating delivery:', error);
      
      // Update file status to show error
      if (formData.files && formData.files.length > 0) {
        setFileUploadStatus(prev => 
          prev.map(status => ({ 
            ...status, 
            status: 'error' as const,
            error: 'Error al subir archivo de cuenta de cobro/remisión'
          }))
        );
      }
    } finally {
      setIsUploadingFiles(false);
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

  const getPendingQuantityForVariant = (orderItem: any) => {
    const variant = variantsBreakdown.find(v => 
      v.product_name === orderItem.product_variants?.products?.name &&
      v.variant_size === orderItem.product_variants?.size &&
      v.variant_color === orderItem.product_variants?.color
    );
    return variant ? variant.total_pending : orderItem.quantity;
  };

  const getFileIcon = (file: File) => {
    return file.type.startsWith('image/') ? Image : FileText;
  };

  const getStatusIcon = (status: FileUploadStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: FileUploadStatus['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Subido</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'uploading':
        return <Badge variant="secondary">Subiendo...</Badge>;
      default:
        return <Badge variant="outline">Pendiente</Badge>;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="order">Seleccionar Orden</Label>
               <Select value={formData.orderId} onValueChange={handleOrderSelect} disabled={ordersLoading || !!preselectedOrderId}>
                 <SelectTrigger>
                   <SelectValue placeholder={ordersLoading ? "Cargando órdenes..." : "Seleccione una orden..."} />
                 </SelectTrigger>
                <SelectContent>
                  {availableOrders.length === 0 && !ordersLoading && (
                    <SelectItem value="no-orders" disabled>
                      No hay órdenes disponibles
                    </SelectItem>
                  )}
                  {availableOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} - {order.workshop_assignments?.[0]?.workshops?.name || 'Sin taller'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500 mt-1">
                Debug: {availableOrders.length} órdenes disponibles
              </div>
            </div>
            
            {selectedOrder && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Items en la orden:</h4>
                <div className="space-y-3">
                  {selectedOrder.order_items?.map((item: any) => (
                    <div key={item.id} className="border-l-4 border-blue-500 pl-3 flex items-center gap-3">
                      {item.product_variants?.products?.image_url ? (
                        <img
                          src={item.product_variants.products.image_url}
                          alt={item.product_variants.products.name || ''}
                          className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                          <Package className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <h5 className="font-medium">{item.product_variants?.products?.name}</h5>
                        <div className="text-sm text-gray-600">
                          <span>Variante: {item.product_variants?.size} - {item.product_variants?.color}</span>
                          <br />
                          <span className="font-medium">Cantidad: {item.quantity}</span>
                        </div>
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
                {selectedOrder.order_items.map((item: any) => {
                  const pendingQuantity = getPendingQuantityForVariant(item);
                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4 gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.product_variants?.products?.image_url ? (
                            <img
                              src={item.product_variants.products.image_url}
                              alt={item.product_variants.products.name || ''}
                              className="w-12 h-12 rounded object-cover flex-shrink-0 border border-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                              <Package className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-semibold">{item.product_variants?.products?.name}</h4>
                            <p className="text-sm text-gray-600">
                              {item.product_variants?.size} - {item.product_variants?.color}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-medium bg-orange-100 text-orange-800 px-2 py-1 rounded flex-shrink-0">
                          Pendientes: {pendingQuantity}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Label htmlFor={`quantity-${item.id}`}>Cantidad a entregar:</Label>
                        <Input
                          id={`quantity-${item.id}`}
                          type="number"
                          min="0"
                          max={pendingQuantity}
                          value={formData.products[item.id] || 0}
                          onChange={(e) => handleVariantChange(item.id, e.target.value)}
                          placeholder="0"
                          className="w-24"
                        />
                      </div>
                    </div>
                  );
                })}
                
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

            <div className="space-y-4">
              <Label htmlFor="files">Cuenta de Cobro/Remisión</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 mb-2">
                  Adjunta la cuenta de cobro o remisión de esta entrega
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
                  disabled={isUploadingFiles}
                >
                  {isUploadingFiles ? 'Subiendo...' : 'Seleccionar Archivos'}
                </Button>
              </div>

              {fileUploadStatus.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium mb-2">Archivos de cuenta de cobro/remisión:</p>
                  {fileUploadStatus.map((fileStatus, index) => {
                    const FileIcon = getFileIcon(fileStatus.file);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <FileIcon className="w-5 h-5 text-gray-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{fileStatus.file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(fileStatus.status)}
                          {getStatusBadge(fileStatus.status)}
                          {fileStatus.status === 'pending' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {fileUploadStatus.some(f => f.status === 'error') && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-600 font-medium">
                        Algunos archivos no se pudieron subir. Puedes intentar nuevamente o continuar sin ellos.
                      </p>
                    </div>
                  )}
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
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {item.product_variants?.products?.image_url ? (
                              <img
                                src={item.product_variants.products.image_url}
                                alt={item.product_variants.products.name || ''}
                                className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <h5 className="font-medium">{item.product_variants?.products?.name}</h5>
                              <p className="text-sm text-gray-600">
                                {item.product_variants?.size} - {item.product_variants?.color}
                              </p>
                            </div>
                          </div>
                          <span className="font-semibold text-blue-700 flex-shrink-0">{quantity} unidades</span>
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

              {fileUploadStatus.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Cuenta de Cobro/Remisión:</h4>
                  <div className="space-y-2">
                    {fileUploadStatus.map((fileStatus, index) => {
                      const FileIcon = getFileIcon(fileStatus.file);
                      return (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <FileIcon className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">{fileStatus.file.name}</span>
                          </div>
                          {getStatusBadge(fileStatus.status)}
                        </div>
                      );
                    })}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl border-0">
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <h2 className="text-xl font-semibold text-black">Registrar Entrega</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-6 py-4 border-b bg-white">
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
            <span>Cantidades y Documentos</span>
            <span>Confirmar</span>
          </div>
        </div>

        <div className="p-6 bg-white">
          {renderStepContent()}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-white">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
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
              disabled={!isStepValid(currentStep) || deliveryLoading || isUploadingFiles}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {deliveryLoading || isUploadingFiles ? 'Registrando...' : 'Registrar Entrega'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DeliveryForm;
