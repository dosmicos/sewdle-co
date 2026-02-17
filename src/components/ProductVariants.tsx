
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, GripVertical, MoreHorizontal, X, Edit2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Variant {
  size: string;
  color: string;
  skuVariant: string;
  additionalPrice: number;
  stockQuantity: number;
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
  const [generatedVariants, setGeneratedVariants] = useState<Variant[]>([]);

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

  // Generar variantes automáticamente cuando cambien las opciones
  useEffect(() => {
    generateVariants();
  }, [variantOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateVariants = () => {
    const colorOption = variantOptions.find(opt => opt.id === 'color');
    const sizeOption = variantOptions.find(opt => opt.id === 'size');
    
    if (!colorOption || !sizeOption || colorOption.values.length === 0 || sizeOption.values.length === 0) {
      setGeneratedVariants([]);
      onVariantsChange([]);
      return;
    }

    const newVariants: Variant[] = [];
    
    // Generar todas las combinaciones posibles
    colorOption.values.forEach(color => {
      sizeOption.values.forEach(size => {
        // Buscar si ya existe esta variante para mantener los datos del usuario
        const existingVariant = generatedVariants.find(v => v.color === color && v.size === size) ||
                               variants.find(v => v.color === color && v.size === size);
        
        newVariants.push({
          size,
          color,
          skuVariant: existingVariant?.skuVariant || `${color.substring(0, 3).toUpperCase()}-${size.split(' ')[0]}`,
          additionalPrice: existingVariant?.additionalPrice || 0,
          stockQuantity: existingVariant?.stockQuantity || 0
        });
      });
    });

    setGeneratedVariants(newVariants);
    onVariantsChange(newVariants);
  };

  const updateVariant = (index: number, field: keyof Variant, value: unknown) => {
    const updatedVariants = [...generatedVariants];
    updatedVariants[index] = { ...updatedVariants[index], [field]: value };
    setGeneratedVariants(updatedVariants);
    onVariantsChange(updatedVariants);
  };

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
          Agregar opción
        </Button>
      </div>

      {/* Sección de Opciones */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Opciones de Variantes</h4>
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

      {/* Sección de Variantes Generadas */}
      {generatedVariants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Variantes Generadas</h4>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {generatedVariants.length} variante{generatedVariants.length !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="space-y-3">
            {generatedVariants.map((variant, index) => (
              <Card key={`${variant.color}-${variant.size}`} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${getColorClass(variant.color)}`}></div>
                      <div>
                        <p className="font-medium text-sm">{variant.color}</p>
                        <p className="text-xs text-gray-500">{variant.size}</p>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-600">SKU Variante</Label>
                      <Input
                        value={variant.skuVariant}
                        onChange={(e) => updateVariant(index, 'skuVariant', e.target.value)}
                        className="h-8 text-sm"
                        placeholder="SKU-VAR"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-600">Precio Adicional</Label>
                      <Input
                        type="number"
                        value={variant.additionalPrice}
                        onChange={(e) => updateVariant(index, 'additionalPrice', Number(e.target.value))}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs text-gray-600">Stock</Label>
                      <Input
                        type="number"
                        value={variant.stockQuantity}
                        onChange={(e) => updateVariant(index, 'stockQuantity', Number(e.target.value))}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Edit2 className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {generatedVariants.length === 0 && variantOptions.some(opt => opt.values.length > 0) && (
        <div className="text-center py-8 text-gray-500">
          <p>Configura al menos un valor en Color y Talla para generar variantes</p>
        </div>
      )}
    </div>
  );
};

export default ProductVariants;
