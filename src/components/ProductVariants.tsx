
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Shirt } from 'lucide-react';

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
  const commonSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const commonColors = ['Blanco', 'Negro', 'Gris', 'Azul', 'Rojo', 'Verde'];

  const addVariant = () => {
    onVariantsChange([...variants, { size: '', color: '', price: '', sku: '' }]);
  };

  const removeVariant = (index: number) => {
    onVariantsChange(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string) => {
    const updated = variants.map((variant, i) => 
      i === index ? { ...variant, [field]: value } : variant
    );
    onVariantsChange(updated);
  };

  const addQuickSizes = () => {
    const newVariants = commonSizes.map(size => ({
      size,
      color: '',
      price: '',
      sku: ''
    }));
    onVariantsChange(newVariants);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black flex items-center gap-2">
          <Shirt className="w-5 h-5" />
          Variantes y Tallas
        </h3>
        <div className="flex space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addQuickSizes}
            className="text-black border-gray-300"
          >
            <Plus className="w-4 h-4 mr-1" />
            Tallas Estándar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addVariant}
            className="text-black border-gray-300"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar Variante
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {variants.map((variant, index) => (
          <Card key={index} className="border border-gray-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="secondary" className="text-xs">
                  Variante #{index + 1}
                </Badge>
                {variants.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeVariant(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-black">Talla *</Label>
                  <div className="space-y-2">
                    <Input
                      value={variant.size}
                      onChange={(e) => updateVariant(index, 'size', e.target.value)}
                      placeholder="Ej: M"
                      className="text-black"
                    />
                    <div className="flex flex-wrap gap-1">
                      {commonSizes.map(size => (
                        <Button
                          key={size}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateVariant(index, 'size', size)}
                          className="text-xs px-2 py-1 h-auto text-gray-600 hover:text-black"
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-black">Color</Label>
                  <div className="space-y-2">
                    <Input
                      value={variant.color}
                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      placeholder="Ej: Blanco"
                      className="text-black"
                    />
                    <div className="flex flex-wrap gap-1">
                      {commonColors.map(color => (
                        <Button
                          key={color}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateVariant(index, 'color', color)}
                          className="text-xs px-2 py-1 h-auto text-gray-600 hover:text-black"
                        >
                          {color}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-black">Precio</Label>
                  <Input
                    value={variant.price}
                    onChange={(e) => updateVariant(index, 'price', e.target.value)}
                    placeholder="$0.00"
                    className="text-black"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-black">SKU</Label>
                  <Input
                    value={variant.sku}
                    onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                    placeholder="CAM-001-M"
                    className="text-black"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {variants.length === 0 && (
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
          <CardContent className="p-8 text-center">
            <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No hay variantes configuradas</p>
            <Button
              type="button"
              onClick={addVariant}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primera Variante
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductVariants;
