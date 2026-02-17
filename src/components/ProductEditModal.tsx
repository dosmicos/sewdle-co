import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { sortVariants } from '@/lib/variantSorting';
import { useVariantSkuUpdate, SkuUpdateSafety } from '@/hooks/useVariantSkuUpdate';
import SkuUpdateConfirmationDialog from './SkuUpdateConfirmationDialog';

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
  const [showSkuConfirmation, setShowSkuConfirmation] = useState(false);
  const [skuUpdateInfo, setSkuUpdateInfo] = useState<{
    variant: ProductVariant;
    safetyInfo: SkuUpdateSafety;
  } | null>(null);
  const { toast } = useToast();
  const { checkUpdateSafety, updateVariantSku, loading: skuUpdateLoading } = useVariantSkuUpdate();

  const fetchProductVariants = useCallback(async () => {
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
      const sortedVariants = sortVariants(fetchedVariants);
      setVariants(sortedVariants);
      setOriginalVariants(sortedVariants);
    } catch (error: unknown) {
      console.error('Error loading variants:', error);
      toast({
        title: "Error al cargar variantes",
        description: error.message || "No se pudieron cargar las variantes del producto.",
        variant: "destructive",
      });
    } finally {
      setLoadingVariants(false);
    }
  }, [product.id, toast]);

  useEffect(() => {
    if (isOpen && product.id) {
      fetchProductVariants();
    }
  }, [isOpen, product.id, fetchProductVariants]);

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

  const updateVariant = (index: number, field: keyof ProductVariant, value: unknown) => {
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

  // Nueva función para comparar variantes y detectar cambios reales
  const compareVariants = (original: ProductVariant[], current: ProductVariant[]) => {
    console.log('=== COMPARANDO VARIANTES ===');
    console.log('Originales:', original);
    console.log('Actuales:', current);

    const operations = {
      toUpdate: [] as ProductVariant[],
      toInsert: [] as ProductVariant[],
      toDelete: [] as ProductVariant[]
    };

    // Identificar variantes a actualizar
    current.forEach(currentVariant => {
      if (currentVariant.id) {
        const originalVariant = original.find(orig => orig.id === currentVariant.id);
        if (originalVariant) {
          // Comparar campo por campo para detectar cambios reales
          const hasChanges = 
            originalVariant.size !== currentVariant.size ||
            originalVariant.color !== currentVariant.color ||
            originalVariant.sku_variant !== currentVariant.sku_variant ||
            originalVariant.additional_price !== currentVariant.additional_price ||
            originalVariant.stock_quantity !== currentVariant.stock_quantity;

          if (hasChanges) {
            console.log(`Cambios detectados en variante ${currentVariant.id}:`, {
              original: originalVariant,
              current: currentVariant
            });
            operations.toUpdate.push(currentVariant);
          } else {
            console.log(`Sin cambios en variante ${currentVariant.id}`);
          }
        }
      } else {
        // Nueva variante
        if (currentVariant.sku_variant && currentVariant.sku_variant.trim() !== '') {
          console.log('Nueva variante detectada:', currentVariant);
          operations.toInsert.push(currentVariant);
        }
      }
    });

    // Identificar variantes a eliminar
    original.forEach(originalVariant => {
      if (originalVariant.id && !current.find(curr => curr.id === originalVariant.id)) {
        console.log('Variante a eliminar:', originalVariant);
        operations.toDelete.push(originalVariant);
      }
    });

    console.log('Operaciones planeadas:', operations);
    return operations;
  };

  // Función mejorada para validar variantes
  const validateVariants = (variants: ProductVariant[]) => {
    const errors: string[] = [];
    const skus = new Set<string>();

    variants.forEach((variant, index) => {
      // Validar SKU requerido
      if (!variant.sku_variant || variant.sku_variant.trim() === '') {
        errors.push(`La variante ${index + 1} requiere un SKU`);
      } else {
        // Validar SKU único
        if (skus.has(variant.sku_variant)) {
          errors.push(`El SKU "${variant.sku_variant}" está duplicado`);
        }
        skus.add(variant.sku_variant);
      }

      // Validar valores numéricos
      if (variant.additional_price < 0) {
        errors.push(`El precio adicional de la variante ${index + 1} no puede ser negativo`);
      }
      if (variant.stock_quantity < 0) {
        errors.push(`El stock de la variante ${index + 1} no puede ser negativo`);
      }
    });

    return errors;
  };

  // Función mejorada para verificar referencias con logging detallado
  const checkVariantReferences = async (variantId: string) => {
    try {
      console.log(`🔍 Verificando referencias para variante ${variantId}...`);
      const referencesFound: string[] = [];
      
      // Verificar en order_items con información adicional
      const { data: orderItems, error: orderError } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          orders!inner(order_number, status)
        `)
        .eq('product_variant_id', variantId);

      if (orderError) {
        console.error('❌ Error verificando referencias en order_items:', orderError);
        return { 
          hasReferences: true, 
          reason: 'Error de conectividad al verificar órdenes',
          details: [`Error: ${orderError.message}`]
        };
      }

      if (orderItems && orderItems.length > 0) {
        const orderNumbers = orderItems.map(item => item.orders?.order_number).join(', ');
        referencesFound.push(`${orderItems.length} órdenes (${orderNumbers})`);
        console.log(`📋 Variante referenciada en ${orderItems.length} order_items:`, orderNumbers);
      }

      // Verificar en inventory_replenishment (solo activas con sugerencias reales)
      const { data: inventoryReplenishment, error: replenishmentError } = await supabase
        .from('inventory_replenishment')
        .select('id, status, calculated_at, suggested_quantity')
        .eq('variant_id', variantId)
        .eq('status', 'pending')
        .gt('suggested_quantity', 0); // Solo bloquear si hay sugerencias reales de reposición

      if (replenishmentError) {
        console.error('❌ Error verificando referencias en inventory_replenishment:', replenishmentError);
        return { 
          hasReferences: true, 
          reason: 'Error de conectividad al verificar reposición',
          details: [`Error: ${replenishmentError.message}`]
        };
      }

      if (inventoryReplenishment && inventoryReplenishment.length > 0) {
        referencesFound.push(`${inventoryReplenishment.length} registros de reposición activos`);
        console.log(`📊 Variante tiene ${inventoryReplenishment.length} registros de reposición activos`);
      }

      if (referencesFound.length > 0) {
        console.log(`⚠️ Variante ${variantId} tiene referencias en:`, referencesFound);
        return {
          hasReferences: true,
          reason: 'La variante está en uso',
          details: referencesFound
        };
      }

      console.log(`✅ Variante ${variantId} no tiene referencias críticas, se puede eliminar`);
      return {
        hasReferences: false,
        reason: 'Sin referencias',
        details: []
      };
    } catch (error) {
      console.error('❌ Error inesperado en checkVariantReferences:', error);
      return {
        hasReferences: true,
        reason: 'Error inesperado en verificación',
        details: [`Error técnico: ${error instanceof Error ? error.message : 'Error desconocido'}`]
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    console.log('=== INICIANDO GUARDADO DE PRODUCTO ===');
    console.log('Producto ID:', product.id);

    try {
      // 1. Validar variantes antes de proceder
      const validationErrors = validateVariants(variants);
      if (validationErrors.length > 0) {
        throw new Error(`Errores de validación:\n${validationErrors.join('\n')}`);
      }

      console.log('✓ Validación de variantes exitosa');

      // 2. Actualizar información básica del producto
      console.log('Actualizando información básica del producto...');
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
        console.error('Error actualizando producto:', productError);
        throw new Error(`Error al actualizar el producto: ${productError.message}`);
      }

      console.log('✓ Producto actualizado exitosamente');

      // 3. Procesar variantes con lógica inteligente
      const operations = compareVariants(originalVariants, variants);

      let operationsCount = 0;
      let successCount = 0;
      const operationResults: string[] = [];

      // Procesar actualizaciones con lógica inteligente de SKU
      for (const variant of operations.toUpdate) {
        operationsCount++;
        console.log(`Actualizando variante ${variant.id}...`);
        
        const originalVariant = originalVariants.find(orig => orig.id === variant.id);
        const skuChanged = originalVariant && originalVariant.sku_variant !== variant.sku_variant;
        
        if (skuChanged) {
          // Usar cascading update para cambios de SKU
          console.log(`SKU cambió de "${originalVariant.sku_variant}" a "${variant.sku_variant}"`);
          const result = await updateVariantSku(variant.id!, variant.sku_variant);
          
          if (result?.success) {
            // También actualizar otros campos si cambió el SKU exitosamente
            if (originalVariant.size !== variant.size ||
                originalVariant.color !== variant.color ||
                originalVariant.additional_price !== variant.additional_price ||
                originalVariant.stock_quantity !== variant.stock_quantity) {
              
              const { error } = await supabase
                .from('product_variants')
                .update({
                  size: variant.size,
                  color: variant.color,
                  additional_price: variant.additional_price,
                  stock_quantity: variant.stock_quantity
                })
                .eq('id', variant.id);
              
              if (error) {
                console.error(`Error actualizando campos adicionales:`, error);
                operationResults.push(`⚠️ SKU actualizado pero error en otros campos "${variant.sku_variant}": ${error.message}`);
              }
            }
            successCount++;
            operationResults.push(`✓ SKU actualizado en cascada "${variant.sku_variant}"`);
          } else {
            operationResults.push(`❌ Error actualizando SKU "${variant.sku_variant}"`);
          }
        } else {
          // Actualización normal sin cambio de SKU
          const { error } = await supabase
            .from('product_variants')
            .update({
              size: variant.size,
              color: variant.color,
              sku_variant: variant.sku_variant,
              additional_price: variant.additional_price,
              stock_quantity: variant.stock_quantity
            })
            .eq('id', variant.id);

          if (error) {
            console.error(`Error actualizando variante ${variant.id}:`, error);
            operationResults.push(`❌ Error actualizando "${variant.sku_variant}": ${error.message}`);
          } else {
            successCount++;
            console.log(`✓ Variante ${variant.id} actualizada exitosamente`);
            operationResults.push(`✓ Actualizada "${variant.sku_variant}"`);
          }
        }
      }

      // Procesar inserciones
      if (operations.toInsert.length > 0) {
        operationsCount += operations.toInsert.length;
        console.log(`Insertando ${operations.toInsert.length} nuevas variantes...`);

        const variantsToInsert = operations.toInsert.map(variant => ({
          product_id: product.id,
          size: variant.size,
          color: variant.color,
          sku_variant: variant.sku_variant,
          additional_price: variant.additional_price,
          stock_quantity: variant.stock_quantity
        }));

        const { error } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        if (error) {
          console.error('Error insertando nuevas variantes:', error);
          operationResults.push(`❌ Error creando variantes nuevas: ${error.message}`);
        } else {
          successCount += operations.toInsert.length;
          console.log(`✓ ${operations.toInsert.length} variantes nuevas creadas exitosamente`);
          operations.toInsert.forEach(variant => {
            operationResults.push(`✓ Creada "${variant.sku_variant}"`);
          });
        }
      }

      // Procesar eliminaciones (con verificación detallada de referencias)
      for (const variant of operations.toDelete) {
        operationsCount++;
        console.log(`🗑️ Procesando eliminación de variante ${variant.id} (${variant.sku_variant})...`);
        
        const referenceCheck = await checkVariantReferences(variant.id!);
        
        if (referenceCheck.hasReferences) {
          console.log(`⚠️ Variante ${variant.id} no se puede eliminar:`, referenceCheck.reason);
          console.log(`📋 Detalles de referencias:`, referenceCheck.details);
          
          // Crear mensaje detallado para el usuario
          const referencesText = referenceCheck.details.length > 0 
            ? ` (${referenceCheck.details.join(', ')})`
            : '';
          
          operationResults.push(`⚠️ "${variant.sku_variant}" no eliminada: ${referenceCheck.reason}${referencesText}`);
        } else {
          console.log(`🗑️ Eliminando variante ${variant.id} - sin referencias...`);
          
          const { error } = await supabase
            .from('product_variants')
            .delete()
            .eq('id', variant.id);

          if (error) {
            console.error(`❌ Error eliminando variante ${variant.id}:`, error);
            console.error('Detalles del error:', error);
            
            // Proporcionar mensaje más específico basado en el tipo de error
            let errorMessage = error.message;
            if (error.code === '23503') {
              errorMessage = 'No se puede eliminar: la variante está referenciada en otros registros';
            } else if (error.code === '42501') {
              errorMessage = 'Error de permisos: no tienes autorización para eliminar esta variante';
            }
            
            operationResults.push(`❌ Error eliminando "${variant.sku_variant}": ${errorMessage}`);
          } else {
            successCount++;
            console.log(`✅ Variante ${variant.id} eliminada exitosamente`);
            operationResults.push(`✅ Eliminada "${variant.sku_variant}"`);
          }
        }
      }

      // 4. Mostrar resultados detallados y mejorar feedback al usuario
      console.log('=== RESUMEN DETALLADO DE OPERACIONES ===');
      console.log(`📊 Total operaciones: ${operationsCount}`);
      console.log(`✅ Exitosas: ${successCount}`);
      console.log(`❌ Fallidas: ${operationsCount - successCount}`);
      console.log('📋 Detalles completos:', operationResults);

      if (successCount === operationsCount && operationsCount > 0) {
        toast({
          title: "✅ Producto actualizado completamente",
          description: `${formData.name} y todas sus variantes han sido actualizadas exitosamente.`,
        });
        
        onSuccess();
        onClose();
      } else if (successCount > 0) {
        // Crear mensaje más descriptivo para actualizaciones parciales
        const failedOperations = operationsCount - successCount;
        const failedDetails = operationResults
          .filter(result => result.includes('❌') || result.includes('⚠️'))
          .slice(0, 3) // Mostrar máximo 3 errores
          .join('; ');
        
        toast({
          title: "⚠️ Producto actualizado parcialmente",
          description: `Completadas ${successCount} de ${operationsCount} operaciones. ${failedOperations} fallaron. ${failedDetails}${operationResults.length > 3 ? '...' : ''}`,
          variant: "destructive",
        });
        
        // Si hay éxito parcial, aún refrescar para mostrar cambios
        onSuccess();
        
      } else if (operationsCount > 0) {
        // Todas las operaciones fallaron
        const firstError = operationResults
          .find(result => result.includes('❌') || result.includes('⚠️'))?.substring(0, 100) || 'Error desconocido';
        
        throw new Error(`No se completó ninguna operación de variantes. Primer error: ${firstError}`);
      } else {
        // Solo se actualizó la información básica del producto (sin operaciones de variantes)
        toast({
          title: "✅ Información básica actualizada",
          description: `${formData.name} ha sido actualizado exitosamente.`,
        });
        
        onSuccess();
        onClose();
      }

    } catch (error: unknown) {
      console.error('=== ERROR EN GUARDADO ===');
      console.error('Error completo:', error);
      
      toast({
        title: "❌ Error al actualizar producto",
        description: error.message || "Hubo un problema al actualizar el producto y sus variantes.",
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

      {/* SKU Update Confirmation Dialog */}
      <SkuUpdateConfirmationDialog
        isOpen={showSkuConfirmation}
        onClose={() => {
          setShowSkuConfirmation(false);
          setSkuUpdateInfo(null);
        }}
        onConfirm={() => {
          // This would be used for individual SKU updates with confirmation
          // For now, the cascading update is handled automatically in handleSubmit
          setShowSkuConfirmation(false);
          setSkuUpdateInfo(null);
        }}
        safetyInfo={skuUpdateInfo?.safetyInfo || null}
        loading={skuUpdateLoading}
      />
    </Dialog>
  );
};

export default ProductEditModal;
