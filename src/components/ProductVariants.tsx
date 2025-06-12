
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Variant {
  size: string;
  color: string;
  price: string;
  sku: string;
}

interface ProductVariantsProps {
  variants: Variant[];
  onVariantsChange: (variants: Variant[]) => void;
}

const ProductVariants = ({ variants, onVariantsChange }: ProductVariantsProps) => {
  const [selectedColors, setSelectedColors] = useState<string[]>(['Gris', 'Rojo', 'Azul Oscuro']);
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['6 a 12 meses', '2 (12 a 24 meses)', '4 (3 - 4 años)', '6 (4 - 5 años)', '8 (6 - 7 años)', '10 (7 - 8 años)', '12 (8 - 9 años)']);

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

  const availableSizes = [
    '6 a 12 meses',
    '2 (12 a 24 meses)', 
    '4 (3 - 4 años)',
    '6 (4 - 5 años)',
    '8 (6 - 7 años)',
    '10 (7 - 8 años)',
    '12 (8 - 9 años)',
    'XS', 'S', 'M', 'L', 'XL', 'XXL'
  ];

  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const addVariantOption = () => {
    // This would open a modal to add custom variant options
    console.log('Add variant option');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Variantes</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addVariantOption}
          className="text-black border-gray-300"
        >
          <Plus className="w-4 h-4 mr-1" />
          Agregar variante
        </Button>
      </div>

      <div className="space-y-6">
        {/* Color Section */}
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <Label className="text-black font-medium">Color</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40">
                  <div className="space-y-2">
                    <button className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded">
                      Editar opciones
                    </button>
                    <button className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded text-red-600">
                      Eliminar
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {availableColors.map(color => (
                <div
                  key={color.name}
                  onClick={() => toggleColor(color.name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    selectedColors.includes(color.name)
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${color.colorClass}`}></div>
                  <span className="text-sm">{color.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Size Section */}
        <Card className="border border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <Label className="text-black font-medium">Talla</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-40">
                  <div className="space-y-2">
                    <button className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded">
                      Editar opciones
                    </button>
                    <button className="w-full text-left text-sm hover:bg-gray-100 p-2 rounded text-red-600">
                      Eliminar
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {availableSizes.map(size => (
                <div
                  key={size}
                  onClick={() => toggleSize(size)}
                  className={`px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    selectedSizes.includes(size)
                      ? 'bg-blue-50 border-blue-200 text-blue-800'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {size}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add Another Option */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={addVariantOption}
            className="text-blue-600 hover:text-blue-700 p-0 h-auto font-normal"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar otra opción
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductVariants;
