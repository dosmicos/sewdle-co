
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X } from 'lucide-react';

interface Material {
  id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  color: string;
  category: string;
  minStockAlert: number;
  currentStock: number;
  image?: string;
  createdAt: string;
}

interface MaterialFormProps {
  material?: Material;
  onClose: () => void;
}

const MaterialForm = ({ material, onClose }: MaterialFormProps) => {
  const [formData, setFormData] = useState({
    sku: material?.sku || '',
    name: material?.name || '',
    description: material?.description || '',
    unit: material?.unit || '',
    color: material?.color || '',
    category: material?.category || '',
    minStockAlert: material?.minStockAlert || 0
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const categories = [
    'Telas',
    'Avíos',
    'Etiquetas',
    'Hilos',
    'Cremalleras',
    'Elásticos',
    'Forros',
    'Entretelas'
  ];

  const units = [
    'metros',
    'centímetros',
    'unidades',
    'kilogramos',
    'gramos',
    'rollos',
    'paquetes'
  ];

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Material data:', formData);
    console.log('Image file:', imageFile);
    // Aquí iría la lógica para guardar el material
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            {material ? 'Editar Material' : 'Nuevo Material'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                SKU *
              </label>
              <Input
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                placeholder="Ej: TEL001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Categoría *
              </label>
              <Select
                value={formData.category}
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Nombre del Material *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ej: Tela Algodón Premium"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Descripción
            </label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción detallada del material..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Unidad de Medida *
              </label>
              <Select
                value={formData.unit}
                onValueChange={(value) => handleInputChange('unit', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar unidad..." />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Color
              </label>
              <Input
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                placeholder="Ej: Azul Marino"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Alerta de Stock Mínimo
              </label>
              <Input
                type="number"
                min="0"
                value={formData.minStockAlert}
                onChange={(e) => handleInputChange('minStockAlert', parseInt(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Imagen del Material
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                id="material-image"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
              <label
                htmlFor="material-image"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Haz clic para subir imagen o arrastra aquí
                </span>
                <span className="text-xs text-gray-500">
                  JPG, PNG, máx 5MB
                </span>
              </label>
              
              {imageFile && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                    <span className="text-sm text-black">{imageFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImageFile(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
              {material ? 'Actualizar' : 'Crear'} Material
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialForm;
