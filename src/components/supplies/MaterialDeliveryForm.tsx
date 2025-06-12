
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Trash2, Plus } from 'lucide-react';

interface MaterialDeliveryFormProps {
  onClose: () => void;
}

const MaterialDeliveryForm = ({ onClose }: MaterialDeliveryFormProps) => {
  const [formData, setFormData] = useState({
    orderId: '',
    workshopId: '',
    deliveredBy: '',
    notes: ''
  });
  const [materials, setMaterials] = useState([
    { materialId: '', quantity: 0, unit: '' }
  ]);
  const [supportDocument, setSupportDocument] = useState<File | null>(null);

  // Mock data
  const orders = [
    { id: 'ORD001', name: 'Ruanas Primavera 2025' },
    { id: 'ORD002', name: 'Camisas Básicas' }
  ];

  const workshops = [
    { id: 'W001', name: 'Taller Principal' },
    { id: 'W002', name: 'Taller Norte' },
    { id: 'W003', name: 'Taller Sur' }
  ];

  const availableMaterials = [
    { id: 'TEL001', name: 'Tela Algodón Premium', sku: 'TEL001', unit: 'metros' },
    { id: 'AVI001', name: 'Botones Plásticos', sku: 'AVI001', unit: 'unidades' },
    { id: 'ETI001', name: 'Etiquetas Marca', sku: 'ETI001', unit: 'unidades' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMaterialChange = (index: number, field: string, value: string | number) => {
    const updated = [...materials];
    updated[index] = { ...updated[index], [field]: value };
    
    // Si se cambia el material, actualizar la unidad automáticamente
    if (field === 'materialId') {
      const selectedMaterial = availableMaterials.find(m => m.id === value);
      if (selectedMaterial) {
        updated[index].unit = selectedMaterial.unit;
      }
    }
    
    setMaterials(updated);
  };

  const addMaterial = () => {
    setMaterials([...materials, { materialId: '', quantity: 0, unit: '' }]);
  };

  const removeMaterial = (index: number) => {
    if (materials.length > 1) {
      setMaterials(materials.filter((_, i) => i !== index));
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSupportDocument(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Entrega de materiales:', {
      ...formData,
      materials,
      supportDocument
    });
    // Aquí iría la lógica para guardar la entrega
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            Nueva Entrega de Materiales
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Orden de Producción *
              </label>
              <Select
                value={formData.orderId}
                onValueChange={(value) => handleInputChange('orderId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar orden..." />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.id} - {order.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Taller Destino *
              </label>
              <Select
                value={formData.workshopId}
                onValueChange={(value) => handleInputChange('workshopId', value)}
              >
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
              <label className="block text-sm font-medium text-black mb-2">
                Entregado por *
              </label>
              <Input
                value={formData.deliveredBy}
                onChange={(e) => handleInputChange('deliveredBy', e.target.value)}
                placeholder="Nombre de quien entrega"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-black">Materiales a Entregar</h3>
              <Button
                type="button"
                variant="outline"
                onClick={addMaterial}
                className="border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar Material
              </Button>
            </div>

            <div className="space-y-4">
              {materials.map((material, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-black">Material #{index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      className="text-red-500 hover:text-red-700"
                      disabled={materials.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-black mb-2">
                        Material
                      </label>
                      <Select
                        value={material.materialId}
                        onValueChange={(value) => handleMaterialChange(index, 'materialId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar material..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMaterials.map((mat) => (
                            <SelectItem key={mat.id} value={mat.id}>
                              {mat.sku} - {mat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-black mb-2">
                        Cantidad
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={material.quantity}
                        onChange={(e) => handleMaterialChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-black mb-2">
                        Unidad
                      </label>
                      <Input
                        value={material.unit}
                        readOnly
                        className="bg-gray-50"
                        placeholder="Selecciona un material"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Documento de Soporte *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="support-document"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="support-document"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Haz clic para subir guía de entrega
                </span>
                <span className="text-xs text-gray-500">
                  PDF, JPG, PNG (máx 10MB)
                </span>
              </label>
              
              {supportDocument && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm text-black">{supportDocument.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSupportDocument(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Notas Adicionales
            </label>
            <Textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Comentarios o instrucciones especiales..."
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              Registrar Entrega
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDeliveryForm;
