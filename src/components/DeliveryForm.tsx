
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, FileText, Image, CheckCircle } from 'lucide-react';

interface DeliveryFormProps {
  onClose: () => void;
}

interface FormData {
  orderId: string;
  variants: Record<string, number>;
  general: {
    observations: string;
  };
  files: FileList | null;
}

// Mock data for orders
const mockOrders = [
  { id: 'ORD-123', name: 'Camisetas Básicas', variants: { 'S': 50, 'M': 100, 'L': 75, 'XL': 25 } },
  { id: 'ORD-124', name: 'Pantalones Jogger', variants: { 'S': 30, 'M': 80, 'L': 60, 'XL': 20 } },
  { id: 'ORD-125', name: 'Sudaderas Premium', variants: { 'S': 25, 'M': 60, 'L': 45, 'XL': 15 } }
];

const DeliveryForm: React.FC<DeliveryFormProps> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    orderId: '',
    variants: {},
    general: {
      observations: ''
    },
    files: null
  });
  const [selectedOrder, setSelectedOrder] = useState<typeof mockOrders[0] | null>(null);

  const handleOrderSelect = (orderId: string) => {
    const order = mockOrders.find(o => o.id === orderId);
    setSelectedOrder(order || null);
    setFormData(prev => ({
      ...prev,
      orderId,
      variants: {}
    }));
  };

  const handleVariantChange = (variant: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      variants: {
        ...prev.variants,
        [variant]: numValue
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      // Validate file types
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const invalidFiles = Array.from(files).filter(file => !validTypes.includes(file.type));
      
      if (invalidFiles.length > 0) {
        alert('Solo se permiten archivos JPG, PNG y PDF');
        return;
      }

      // Validate total size (100MB = 100 * 1024 * 1024 bytes)
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

  const handleSubmit = () => {
    console.log('Submitting delivery:', formData);
    // Here you would normally send the data to your backend
    onClose();
  };

  const getTotalDelivered = () => {
    return Object.values(formData.variants).reduce((total: number, quantity) => total + (quantity || 0), 0);
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.orderId !== '';
      case 2:
        return Object.keys(formData.variants).length > 0 && getTotalDelivered() > 0;
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
              <Select value={formData.orderId} onValueChange={handleOrderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione una orden..." />
                </SelectTrigger>
                <SelectContent>
                  {mockOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.id} - {order.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedOrder && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">Variantes disponibles:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(selectedOrder.variants).map(([variant, quantity]) => (
                    <div key={variant} className="flex justify-between">
                      <span>{variant}:</span>
                      <span className="font-medium">{quantity} pendientes</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="font-medium">Cantidades a Entregar</h3>
            {selectedOrder && (
              <div className="space-y-3">
                {Object.entries(selectedOrder.variants).map(([variant, pendingQty]) => (
                  <div key={variant} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{variant}</span>
                      <span className="text-sm text-gray-600 ml-2">({pendingQty} pendientes)</span>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        max={pendingQty}
                        value={formData.variants[variant] || ''}
                        onChange={(e) => handleVariantChange(variant, e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
                <div className="text-right pt-2 border-t">
                  <span className="font-medium">Total a entregar: {getTotalDelivered()}</span>
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
                <h4 className="font-medium mb-2">Orden: {formData.orderId}</h4>
                <div className="space-y-1">
                  {Object.entries(formData.variants).map(([variant, quantity]) => (
                    <div key={variant} className="flex justify-between text-sm">
                      <span>{variant}:</span>
                      <span>{quantity} unidades</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span>Total:</span>
                    <span>{getTotalDelivered()} unidades</span>
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
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Registrar Entrega</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((step) => (
              <React.Fragment key={step}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step <= currentStep ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`flex-1 h-1 rounded ${
                    step < currentStep ? 'bg-blue-500' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
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
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="bg-green-500 hover:bg-green-600"
            >
              Enviar Entrega
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default DeliveryForm;
