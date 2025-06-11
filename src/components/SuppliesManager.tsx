
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

interface Supply {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface SuppliesManagerProps {
  supplies: Supply[];
  onSuppliesChange: (supplies: Supply[]) => void;
}

const SuppliesManager = ({ supplies, onSuppliesChange }: SuppliesManagerProps) => {
  const addSupply = () => {
    const newSupply: Supply = {
      id: Date.now().toString(),
      name: '',
      quantity: 0,
      unit: 'unidades'
    };
    onSuppliesChange([...supplies, newSupply]);
  };

  const removeSupply = (id: string) => {
    onSuppliesChange(supplies.filter(supply => supply.id !== id));
  };

  const updateSupply = (id: string, field: keyof Supply, value: string | number) => {
    onSuppliesChange(
      supplies.map(supply =>
        supply.id === id ? { ...supply, [field]: value } : supply
      )
    );
  };

  return (
    <div className="space-y-4">
      {supplies.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No hay insumos agregados</p>
          <p className="text-sm">Haz clic en "Agregar Insumo" para comenzar</p>
        </div>
      )}

      {supplies.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-600">
            <div className="col-span-5">Nombre</div>
            <div className="col-span-3">Cantidad</div>
            <div className="col-span-3">Unidad</div>
            <div className="col-span-1">Acciones</div>
          </div>

          {supplies.map((supply) => (
            <div key={supply.id} className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-5">
                <Input
                  value={supply.name}
                  onChange={(e) => updateSupply(supply.id, 'name', e.target.value)}
                  placeholder="Ej: Paño lency fucsia"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={supply.quantity}
                  onChange={(e) => updateSupply(supply.id, 'quantity', parseFloat(e.target.value) || 0)}
                  placeholder="Ej: 0.5"
                />
              </div>
              <div className="col-span-3">
                <Input
                  value={supply.unit}
                  onChange={(e) => updateSupply(supply.id, 'unit', e.target.value)}
                  placeholder="metros, kg, unidades"
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSupply(supply.id)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={addSupply}
        className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:text-black hover:border-gray-400"
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Insumo
      </Button>
    </div>
  );
};

export default SuppliesManager;
