
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Plus, Upload, Trash2 } from 'lucide-react';
import ProductSelector from '@/components/ProductSelector';
import SuppliesManager from '@/components/SuppliesManager';
import { useWorkshops } from '@/hooks/useWorkshops';

interface OrderFormProps {
  onClose: () => void;
}

const OrderForm = ({ onClose }: OrderFormProps) => {
  const [selectedWorkshop, setSelectedWorkshop] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [supplies, setSupplies] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [cuttingOrderFile, setCuttingOrderFile] = useState<File | null>(null);

  const { workshops, loading: workshopsLoading } = useWorkshops();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCuttingOrderFile(file);
    }
  };

  const removeFile = () => {
    setCuttingOrderFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Orden de producción:', {
      workshop: selectedWorkshop,
      products: selectedProducts,
      supplies,
      cuttingOrderFile,
      notes
    });
    // Aquí iría la lógica para guardar la orden
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            Nueva Orden de Producción
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
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
          </Card>

          {/* Módulo de Insumos */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-black">Insumos Necesarios</h3>
            <SuppliesManager 
              supplies={supplies}
              onSuppliesChange={setSupplies}
            />
          </Card>

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
              onClick={onClose}
              className="px-6"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6"
            >
              Crear Orden
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderForm;
