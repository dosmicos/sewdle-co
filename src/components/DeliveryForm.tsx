
import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, ArrowRight, Upload, X, AlertCircle, Camera, File, CheckCircle } from 'lucide-react';

// Mock data for orders assigned to the workshop
const mockAssignedOrders = [
  {
    id: 'ORD-123',
    name: 'Camisetas Sport Verano 2023',
    variants: [
      { id: 'v1', name: 'Blanco / S', total: 50, pending: 20 },
      { id: 'v2', name: 'Blanco / M', total: 60, pending: 24 },
      { id: 'v3', name: 'Azul / S', total: 40, pending: 16 },
      { id: 'v4', name: 'Azul / M', total: 30, pending: 12 }
    ]
  },
  {
    id: 'ORD-124',
    name: 'Pantalones Casual Otoño 2023',
    variants: [
      { id: 'v5', name: 'Negro / 32', total: 40, pending: 40 },
      { id: 'v6', name: 'Negro / 34', total: 35, pending: 35 },
      { id: 'v7', name: 'Gris / 32', total: 30, pending: 30 },
      { id: 'v8', name: 'Gris / 34', total: 25, pending: 25 }
    ]
  }
];

const DeliveryForm = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveryItems, setDeliveryItems] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [errors, setErrors] = useState({});

  // Step 1: Select order
  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    
    // Initialize delivery items with 0 quantities
    const initialDeliveryItems = {};
    order.variants.forEach(variant => {
      initialDeliveryItems[variant.id] = 0;
    });
    setDeliveryItems(initialDeliveryItems);
    
    setStep(2);
  };

  // Step 2: Update quantities
  const handleQuantityChange = (variantId, value) => {
    const variant = selectedOrder.variants.find(v => v.id === variantId);
    const numValue = parseInt(value, 10) || 0;
    
    // Validate quantity
    let newErrors = { ...errors };
    if (numValue < 0) {
      newErrors[variantId] = 'La cantidad no puede ser negativa';
    } else if (numValue > variant.pending) {
      newErrors[variantId] = `La cantidad no puede exceder ${variant.pending} unidades pendientes`;
    } else {
      delete newErrors[variantId];
    }
    
    setErrors(newErrors);
    setDeliveryItems({
      ...deliveryItems,
      [variantId]: numValue
    });
  };

  // Step 2: File upload handling
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;
    
    // Validate file count
    if (uploadedFiles.length + files.length > 5) {
      setErrors({
        ...errors,
        files: 'No puedes subir más de 5 archivos'
      });
      return;
    }
    
    // Validate file types and size
    const totalSize = [...uploadedFiles, ...files].reduce((sum, file) => sum + file.size, 0);
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    if (totalSize > maxSize) {
      setErrors({
        ...errors,
        files: 'El tamaño total no puede exceder 100MB'
      });
      return;
    }
    
    // Validate file types
    const invalidFiles = files.filter(file => {
      const fileType = file.type.toLowerCase();
      return !(
        fileType === 'image/jpeg' ||
        fileType === 'image/png' ||
        fileType === 'application/pdf'
      );
    });
    
    if (invalidFiles.length > 0) {
      setErrors({
        ...errors,
        files: 'Solo se permiten archivos JPG, PNG o PDF'
      });
      return;
    }
    
    // Clear any file errors and add new files
    const newErrors = { ...errors };
    delete newErrors.files;
    setErrors(newErrors);
    
    setUploadedFiles([...uploadedFiles, ...files]);
  };

  const removeFile = (index) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
    
    // Clear file error if any
    if (errors.files) {
      const newErrors = { ...errors };
      delete newErrors.files;
      setErrors(newErrors);
    }
  };

  const handleNextStep = () => {
    if (step === 2) {
      // Validate if at least one variant has a quantity > 0
      const hasQuantity = Object.values(deliveryItems).some(qty => qty > 0);
      if (!hasQuantity) {
        setErrors({
          ...errors,
          general: 'Debes ingresar al menos una cantidad para continuar'
        });
        return;
      }
      
      // Clear general error
      const newErrors = { ...errors };
      delete newErrors.general;
      setErrors(newErrors);
    }
    
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = () => {
    // Here is where you would submit the delivery data to your backend
    console.log('Submitting delivery:', {
      order: selectedOrder,
      items: deliveryItems,
      files: uploadedFiles
    });
    
    // Close the form
    onClose();
  };

  const getFileIcon = (file) => {
    const fileType = file.type.toLowerCase();
    if (fileType.includes('image')) return <Camera className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <File className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Seleccionar Orden de Producción</h3>
            <div className="grid gap-4">
              {mockAssignedOrders.map(order => (
                <Card 
                  key={order.id}
                  className="p-4 cursor-pointer hover:bg-blue-50 transition-colors border-2 border-transparent hover:border-blue-200"
                  onClick={() => handleSelectOrder(order)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{order.id}</h4>
                      <p className="text-sm text-gray-600">{order.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {order.variants.length} variante(s) • 
                        {order.variants.reduce((sum, v) => sum + v.pending, 0)} unidades pendientes
                      </p>
                    </div>
                    <ArrowRight className="text-gray-400" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
        
      case 2:
        if (!selectedOrder) return null;
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Cantidades y Documentos</h3>
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm font-medium">{selectedOrder.id} - {selectedOrder.name}</p>
            </div>
            
            {/* Quantities Table */}
            <div>
              <h4 className="text-sm font-medium mb-2">Cantidades a entregar</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variante</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.variants.map(variant => (
                    <TableRow key={variant.id}>
                      <TableCell>{variant.name}</TableCell>
                      <TableCell>{variant.pending}</TableCell>
                      <TableCell>
                        <div className="w-20">
                          <Input
                            type="number"
                            min="0"
                            max={variant.pending}
                            value={deliveryItems[variant.id] || 0}
                            onChange={(e) => handleQuantityChange(variant.id, e.target.value)}
                            className={errors[variant.id] ? "border-red-500" : ""}
                          />
                          {errors[variant.id] && (
                            <p className="text-xs text-red-500 mt-1">{errors[variant.id]}</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {errors.general && (
                <div className="flex items-center text-red-500 mt-2 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.general}
                </div>
              )}
            </div>
            
            {/* File Upload */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Documentos y Fotografías</h4>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-2">
                  <Label htmlFor="file-upload" className="cursor-pointer text-blue-500 hover:text-blue-700">
                    Haz clic para seleccionar archivos
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    JPG, PNG, PDF (máx. 5 archivos, 100MB total)
                  </p>
                </div>
              </div>
              
              {errors.files && (
                <div className="flex items-center text-red-500 mt-2 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.files}
                </div>
              )}
              
              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium mb-2">Archivos ({uploadedFiles.length}/5)</h5>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                        <div className="flex items-center">
                          {getFileIcon(file)}
                          <span className="ml-2 text-sm truncate max-w-[200px]">{file.name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeFile(index)}
                          className="text-gray-500 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
        
      case 3:
        if (!selectedOrder) return null;
        
        // Calculate summary data
        const totalItems = Object.entries(deliveryItems).reduce((sum, [_, qty]) => sum + qty, 0);
        const isComplete = selectedOrder.variants.every(
          v => deliveryItems[v.id] === v.pending
        );
        
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Confirmar Entrega</h3>
            
            {/* Order Summary */}
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="font-medium">{selectedOrder.id} - {selectedOrder.name}</p>
              <div className="flex items-center mt-2 text-sm">
                <span className="text-gray-600">Estado de entrega:</span>
                <span className="ml-2 font-medium">
                  {isComplete ? (
                    <span className="text-green-600 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" /> Completa
                    </span>
                  ) : (
                    <span className="text-blue-600">Parcial</span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Delivery Summary */}
            <div>
              <h4 className="text-sm font-medium mb-2">Resumen de entrega</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variante</TableHead>
                    <TableHead>Pendientes</TableHead>
                    <TableHead>A entregar</TableHead>
                    <TableHead>Quedarán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedOrder.variants.map(variant => {
                    const quantity = deliveryItems[variant.id] || 0;
                    const remaining = variant.pending - quantity;
                    return (
                      <TableRow key={variant.id}>
                        <TableCell>{variant.name}</TableCell>
                        <TableCell>{variant.pending}</TableCell>
                        <TableCell className="font-medium">
                          {quantity > 0 ? quantity : '-'}
                        </TableCell>
                        <TableCell>{remaining}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            {/* Files Summary */}
            {uploadedFiles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Documentos adjuntos</h4>
                <p className="text-sm text-gray-600">
                  {uploadedFiles.length} archivo(s) adjunto(s)
                </p>
              </div>
            )}
            
            {/* Confirmation Alert */}
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Estás por registrar una entrega de {totalItems} unidades
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Esta acción notificará automáticamente a los responsables de calidad.
                    Una vez enviada, no podrá ser editada.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[540px] w-full space-y-6">
        <SheetHeader>
          <SheetTitle className="text-xl font-bold">Registrar Entrega</SheetTitle>
        </SheetHeader>
          
        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-4">
          {['Seleccionar Orden', 'Detalles', 'Confirmar'].map((stepName, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <div className={`flex-1 h-1 ${idx < step ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
              )}
              <div className="flex flex-col items-center">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                    ${idx + 1 === step ? 'bg-blue-500 text-white' : 
                      idx + 1 < step ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}
                >
                  {idx + 1 < step ? <CheckCircle className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="text-xs mt-1 text-gray-600">{stepName}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
          
        <div>{renderStepContent()}</div>
          
        <SheetFooter className="flex justify-between sm:justify-between">
          {step > 1 ? (
            <Button 
              variant="outline" 
              onClick={handlePrevStep}
              className="flex items-center"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Anterior
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          )}
            
          {step < 3 ? (
            <Button onClick={handleNextStep}>
              Siguiente
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
              Confirmar Entrega
              <CheckCircle className="ml-1 h-4 w-4" />
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default DeliveryForm;
