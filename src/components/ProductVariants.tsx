
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, MoreHorizontal, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Variant {
  size: string;
  color: string;
  price: string;
  sku: string;
}

interface VariantOption {
  id: string;
  name: string;
  values: string[];
}

interface ProductVariantsProps {
  variants: Variant[];
  onVariantsChange: (variants: Variant[]) => void;
}

const ProductVariants = ({ variants, onVariantsChange }: ProductVariantsProps) => {
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([
    {
      id: 'color',
      name: 'Color',
      values: ['Gris', 'Rojo', 'Azul Oscuro']
    },
    {
      id: 'size',
      name: 'Talla',
      values: ['6 a 12 meses', '2 (12 a 24 meses)', '4 (3 - 4 años)', '6 (4 - 5 años)', '8 (6 - 7 años)', '10 (7 - 8 años)', '12 (8 - 9 años)']
    }
  ]);

  const [showAddOption, setShowAddOption] = useState(false);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionValue, setNewOptionValue] = useState('');
  const [editingOption, setEditingOption] = useState<string | null>(null);

  const availableColors = [
    { name: 'Blanco', colorClass: 'bg-white border border-gray-300' },
    { name: 'Negro', colorClass: 'bg-black' },
    { name: 'Gris', colorClass: 'bg-gray-500' },
    { name: 'Rojo', colorClass: 'bg-red-500' },
    { name: 'Azul', colorClass: 'bg-blue-500' },
    { name: 'Azul Oscuro', colorClass: 'bg-blue-900' },
    { name: 'Verde', colorClass: 'bg-green-500' },
    { name: 'Amarillo', colorClass: 'bg-yellow-500' },
    { name: 'Rosa', colorClass: 'bg-pink-500' },
    { name: 'Morado', colorClass: 'bg-purple-500' }
  ];

  const addNewVariantOption = () => {
    if (newOptionName.trim()) {
      const newOption: VariantOption = {
        id: newOptionName.toLowerCase().replace(/\s+/g, '_'),
        name: newOptionName,
        values: []
      };
      setVariantOptions(prev => [...prev, newOption]);
      setNewOptionName('');
      setShowAddOption(false);
    }
  };

  const addValueToOption = (optionId: string, value: string) => {
    if (value.trim()) {
      setVariantOptions(prev => 
        prev.map(option => 
          option.id === optionId 
            ? { ...option, values: [...option.values, value.trim()] }
            : option
        )
      );
    }
  };

  const removeValueFromOption = (optionId: string, valueToRemove: string) => {
    setVariantOptions(prev => 
      prev.map(option => 
        option.id === optionId 
          ? { ...option, values: option.values.filter(value => value !== valueToRemove) }
          : option
      )
    );
  };

  const removeVariantOption = (optionId: string) => {
    setVariantOptions(prev => prev.filter(option => option.id !== optionId));
  };

  const getColorClass = (colorName: string) => {
    const color = availableColors.find(c => c.name === colorName);
    return color ? color.colorClass : 'bg-gray-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Variantes</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAddOption(true)}
          className="text-black border-gray-300"
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar variante
        </Button>
      </div>

      <div className="space-y-6">
        {variantOptions.map((option) => (
          <Card key={option.id} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <Label className="text-black font-medium">{option.name}</Label>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40">
                    <div className="space-y-2">
                      <button 
                        onClick={() => setEditingOption(option.id)}
                        className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded"
                      >
                        Editar opciones
                      </button>
                      <button 
                        onClick={() => removeVariantOption(option.id)}
                        className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded text-red-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-3">
                {option.values.map((value) => (
                  <div
                    key={value}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-800"
                  >
                    {option.id === 'color' && (
                      <div className={`w-4 h-4 rounded-full ${getColorClass(value)}`}></div>
                    )}
                    <span className="text-sm">{value}</span>
                    <button
                      onClick={() => removeValueFromOption(option.id, value)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {editingOption === option.id && (
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder={`Agregar ${option.name.toLowerCase()}`}
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addValueToOption(option.id, newOptionValue);
                        setNewOptionValue('');
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      addValueToOption(option.id, newOptionValue);
                      setNewOptionValue('');
                    }}
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Agregar
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingOption(null);
                      setNewOptionValue('');
                    }}
                    size="sm"
                    variant="outline"
                  >
                    Listo
                  </Button>
                </div>
              )}

              {editingOption !== option.id && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingOption(option.id)}
                  className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar {option.name.toLowerCase()}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {showAddOption && (
          <Card className="border border-gray-200 bg-gray-50">
            <CardContent className="p-4">
              <Label className="text-black font-medium mb-2 block">Nombre de la opción</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej: Material, Estilo, etc."
                  value={newOptionName}
                  onChange={(e) => setNewOptionName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addNewVariantOption();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={addNewVariantOption}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Agregar
                </Button>
                <Button
                  onClick={() => {
                    setShowAddOption(false);
                    setNewOptionName('');
                  }}
                  size="sm"
                  variant="outline"
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-sm text-red-600 mt-1">El nombre de la opción es obligatorio.</p>
            </CardContent>
          </Card>
        )}

        {!showAddOption && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddOption(true)}
              className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal"
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar otra opción
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductVariants;
