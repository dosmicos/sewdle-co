
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  base_price: number;
  image_url: string;
  status: string;
  created_at: string;
}

interface ProductVariant {
  id?: string;
  size: string;
  color: string;
  sku_variant: string;
  additional_price: number;
  stock_quantity: number;
}

interface ProductEditModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ProductEditModal = ({ product, isOpen, onClose, onSuccess }: ProductEditModalProps) => {
  const [formData, setFormData] = useState({
    name: product.name,
    description: product.description || '',
    sku: product.sku,
    category: product.category || '',
    base_price: product.base_price,
    image_url: product.image_url || '',
  });

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [originalVariants, setOriginalVariants] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && product.id) {
      fetchProductVariants();
    }
  }, [isOpen, product.id]);

  const fetchProductVariants = async () => {
    try {
      setLoadingVariants(true);
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id);

      if (error) {
        console.error('Error fetching variants:', error);
        throw error;
      }

      console.log('Fetched variants:', data);
      const fetchedVariants = data || [];
      setVariants(fetchedVariants);
      setOriginalVariants(fetchedVariants);
    } catch (error: any) {
      console.error('Error loading variants:', error);
      toast({
        title: "Error al cargar variantes",
        description: error.message || "No se pudieron cargar las variantes del producto.",
        variant: "destructive",
      });
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'base_price' ? parseFloat(value) || 0 : value 
    }));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, {
      size: '',
      color: '',
      sku_variant: '',
      additional_price: 0,
      stock_quantity: 0
    }]);
  };

  const updateVariant = (index: number, field: keyof ProductVariant, value: any) => {
    const updatedVariants = [...variants];
    updatedVariants[index] = {
      ...updatedVariants[index],
      [field]: field === 'additional_price' || field === 'stock_quantity' ? 
        parseFloat(value) || 0 : value
    };
    setVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar datos antes de enviar
      const validVariants = variants.filter(variant => 
        variant.sku_variant && variant.sku_variant.trim() !== ''
      );

      console.log('Original variants:', originalVariants);
      console.log('Current variants:', validVariants);

      // Actualizar información básica del producto
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: formData.name,
          description: formData.description,
          sku: formData.sku,
          category: formData.category,
          base_price: formData.base_price,
          image_url: formData.image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (productError) {
        console.error('Error updating product:', productError);
        throw new Error('Error al actualizar el producto');
      }

      console.log('Product updated successfully');

      // Lógica inteligente para variantes
      const originalIds = new Set(originalVariants.map(v => v.id).filter(Boolean));
      const currentIds = new Set(validVariants.map(v => v.id).filter(Boolean));

      // 1. Actualizar variantes existentes
      for (const variant of validVariants) {
        if (variant.id && originalIds.has(variant.id)) {
          console.log('Updating existing variant:', variant.id);
          const { error: updateError } = await supabase
            .from('product_variants')
            .update({
              size: variant.size,
              color: variant.color,
              sku_variant: variant.sku_variant,
              additional_price: variant.additional_price,
              stock_quantity: variant.stock_quantity
            })
            .eq('id', variant.id);

          if (updateError) {
            console.error('Error updating variant:', variant.id, updateError);
            throw new Error(`Error al actualizar variante: ${updateError.message}`);
          }
        }
      }

      // 2. Insertar variantes nuevas
      const newVariants = validVariants.filter(variant => !variant.id);
      if (newVariants.length > 0) {
        console.log('Inserting new variants:', newVariants);
        const variantsToInsert = newVariants.map(variant => ({
          product_id: product.id,
          size: variant.size,
          color: variant.color,
          sku_variant: variant.sku_variant,
          additional_price: variant.additional_price,
          stock_quantity: variant.stock_quantity
        }));

        const { error: insertError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        if (insertError) {
          console.error('Error inserting new variants:', insertError);
          throw new Error(`Error al crear nuevas variantes: ${insertError.message}`);
        }
      }

      // 3. Eliminar variantes que ya no están (solo si no están referenciadas)
      const variantsToDelete = originalVariants.filter(
        original => original.id && !currentIds.has(original.id)
      );

      for (const variantToDelete of variantsToDelete) {
        console.log('Attempting to delete variant:', variantToDelete.id);
        
        // Verificar si la variante está siendo referenciada
        const { data: orderItems, error: checkError } = await supabase
          .from('order_items')
          .select('id')
          .eq('product_variant_id', variantToDelete.id)
          .limit(1);

        if (checkError) {
          console.error('Error checking variant references:', checkError);
          continue; // Continuar con la siguiente variante
        }

        if (orderItems && orderItems.length > 0) {
          console.log('Variant is referenced in orders, skipping deletion:', variantToDelete.id);
          toast({
            title: "Advertencia",
            description: `La variante "${variantToDelete.sku_variant}" no se puede eliminar porque está siendo utilizada en órdenes existentes.`,
            variant: "destructive",
          });
          continue;
        }

        // Si no está referenciada, proceder con la eliminación
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .eq('id', variantToDelete.id);

        if (deleteError) {
          console.error('Error deleting variant:', variantToDelete.id, deleteError);
          // No lanzar error, solo registrar y continuar
        } else {
          console.log('Variant deleted successfully:', variantToDelete.id);
        }
      }

      toast({
        title: "Producto actualizado",
        description: `${formData.name} ha sido actualizado exitosamente.`,
      });

      onSuccess();
      onClose();

    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: "Error al actualizar producto",
        description: error.message || "Hubo un problema al actualizar el producto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">
            Editar Producto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div>
            <h3 className="text-lg font-semibold text-black mb-4">Información Básica</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name" className="text-black font-medium">
                  Nombre del Producto <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sku" className="text-black font-medium">SKU</Label>
                <Input
                  type="text"
                  id="sku"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="category" className="text-black font-medium">Categoría</Label>
                <Input
                  type="text"
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="base_price" className="text-black font-medium">Precio Base</Label>
                <Input
                  type="number"
                  id="base_price"
                  name="base_price"
                  value={formData.base_price}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="mt-4">
              <Label htmlFor="description" className="text-black font-medium">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="min-h-[100px] mt-1"
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="image_url" className="text-black font-medium">URL de Imagen</Label>
              <Input
                type="url"
                id="image_url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                className="mt-1"
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>
          </div>

          {/* Variantes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-black">Variantes</h3>
              <Button
                type="button"
                onClick={addVariant}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Variante
              </Button>
            </div>

            {loadingVariants ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-600 mt-2">Cargando variantes...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <Card key={index} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <Badge variant="outline">
                          {variant.id ? `Variante ${index + 1} (ID: ${variant.id})` : `Nueva Variante ${index + 1}`}
                        </Badge>
                        <Button
                          type="button"
                          onClick={() => removeVariant(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-black font-medium">Talla</Label>
                          <Input
                            value={variant.size}
                            onChange={(e) => updateVariant(index, 'size', e.target.value)}
                            placeholder="Ej: M, L, XL"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-black font-medium">Color</Label>
                          <Input
                            value={variant.color}
                            onChange={(e) => updateVariant(index, 'color', e.target.value)}
                            placeholder="Ej: Rojo, Azul"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-black font-medium">SKU Variante <span className="text-red-500">*</span></Label>
                          <Input
                            value={variant.sku_variant}
                            onChange={(e) => updateVariant(index, 'sku_variant', e.target.value)}
                            placeholder="Ej: CAM-001-M-R"
                            className="mt-1"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <Label className="text-black font-medium">Precio Adicional</Label>
                          <Input
                            type="number"
                            value={variant.additional_price}
                            onChange={(e) => updateVariant(index, 'additional_price', e.target.value)}
                            min="0"
                            step="0.01"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-black font-medium">Stock</Label>
                          <Input
                            type="number"
                            value={variant.stock_quantity}
                            onChange={(e) => updateVariant(index, 'stock_quantity', e.target.value)}
                            min="0"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {variants.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <p className="text-gray-600">No hay variantes configuradas</p>
                    <Button
                      type="button"
                      onClick={addVariant}
                      variant="ghost"
                      className="mt-2 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Agregar primera variante
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              disabled={loading}
              className="px-8"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="px-8 bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductEditModal;
