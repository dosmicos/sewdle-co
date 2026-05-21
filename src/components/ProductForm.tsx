import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductVariants from '@/components/ProductVariants';
import TechnicalFileUpload from '@/components/TechnicalFileUpload';
import ShopifyProductImport from '@/components/ShopifyProductImport';
import ProductImageUpload from '@/components/ProductImageUpload';
import { useStoreContext } from '@/contexts/StoreContext';

interface ProductFormProps {
  onSuccess: () => void;
}

interface ProductVariant {
  size: string;
  color: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  variants: ProductVariant[];
}

const ProductForm = ({ onSuccess }: ProductFormProps) => {
  const [open, setOpen] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    imageUrl: '',
    sku: '',
    brand: '',
    technicalSpecs: ''
  });

  const [variants, setVariants] = useState<any[]>([]);
  const [technicalFiles, setTechnicalFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { activeStoreId } = useStoreContext();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilesChange = (files: File[]) => {
    setTechnicalFiles(files);
  };

  const handleVariantsChange = (newVariants: any[]) => {
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { size: '', color: '', skuVariant: '', additionalPrice: 0, stockQuantity: 0 }]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updatedVariants = [...variants];
    updatedVariants[index][field] = value;
    setVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    const updatedVariants = variants.filter((_, i) => i !== index);
    setVariants(updatedVariants);
  };

  const handleImageUploaded = (url: string) => {
    setFormData(prev => ({ ...prev, imageUrl: url }));
  };

  const handleImageRemoved = () => {
    setFormData(prev => ({ ...prev, imageUrl: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generar SKU automático si no se proporciona
      let productSku = formData.sku.trim();
      if (!productSku) {
        productSku = `PROD-${Date.now()}`;
      }

      // Subir primero el archivo técnico si existe
      let technicalFileUrl = null;
      if (technicalFiles.length > 0) {
        const technicalFile = technicalFiles[0];
        const { data, error } = await supabase.storage
          .from('product-files')
          .upload(`${productSku}/${technicalFile.name}`, technicalFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error('Error uploading technical file:', error);
          throw new Error('Error al subir el archivo técnico');
        }

        technicalFileUrl = `https://lovatocom.supabase.co/storage/v1/object/public/${data.fullPath}`;
        console.log('Technical file uploaded:', technicalFileUrl);
      }

      // Crear el producto principal
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: formData.name,
            description: formData.description,
            sku: productSku,
            category: formData.brand,
            base_price: formData.basePrice,
            image_url: formData.imageUrl,
            technical_file_url: technicalFileUrl,
            ...(activeStoreId ? { store_id: activeStoreId } : {}),
          }
        ])
        .select()
        .single();

      if (productError) {
        console.error('Error creating product:', productError);
        throw new Error('Error al crear el producto');
      }

      console.log('Product created:', productData);

      // Crear las variantes del producto
      if (variants.length > 0) {
        const variantsToInsert = variants.map(variant => ({
          product_id: productData.id,
          size: variant.size,
          color: variant.color,
          sku_variant: variant.skuVariant,
          additional_price: variant.additionalPrice,
          stock_quantity: variant.stockQuantity
        }));

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        if (variantsError) {
          console.error('Error creating variants:', variantsError);
          throw new Error('Error al crear las variantes');
        }

        console.log('Variants created:', variantsToInsert);
      }

      toast({
        title: "Producto creado exitosamente",
        description: `${formData.name} ha sido añadido a tu catálogo.`,
      });

      handleClose();

    } catch (error: any) {
      console.error('Error creating product:', error);
      toast({
        title: "Error al crear producto",
        description: error.message || "Hubo un problema al crear el producto.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShopifyImport = async (product: ShopifyProduct) => {
    setFormData({
      name: product.title,
      description: product.description,
      basePrice: product.price,
      imageUrl: product.image_url,
      sku: `SKU-${Date.now()}`,
      brand: '',
      technicalSpecs: ''
    });
    
    setVariants(product.variants.map(variant => ({
      size: variant.size,
      color: variant.color,
      skuVariant: variant.sku,
      additionalPrice: 0,
      stockQuantity: variant.stock_quantity
    })));
  };

  const handleClose = () => {
    setOpen(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black">Agregar Producto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shopify" className="flex items-center gap-2">
              <span>📝</span>
              Importar de Shopify
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-2">
              <span>📦</span>
              Crear Nuevo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6 mt-6">
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
                      placeholder="Ej: Camiseta Básica Algodón"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku" className="text-black font-medium">
                      SKU <span className="text-sm text-gray-500">(opcional)</span>
                    </Label>
                    <Input
                      type="text"
                      id="sku"
                      name="sku"
                      placeholder="Ej: CAM-001 (se generará automáticamente si se omite)"
                      value={formData.sku}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="brand" className="text-black font-medium">Categoría</Label>
                    <Input
                      type="text"
                      id="brand"
                      name="brand"
                      placeholder="Ej: Ropa, Accesorios"
                      value={formData.brand}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="basePrice" className="text-black font-medium">Precio Base</Label>
                    <Input
                      type="number"
                      id="basePrice"
                      name="basePrice"
                      placeholder="0"
                      value={formData.basePrice}
                      onChange={handleInputChange}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label htmlFor="description" className="text-black font-medium">Descripción</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe las características principales del producto..."
                    value={formData.description}
                    onChange={handleInputChange}
                    className="min-h-[100px] mt-1"
                  />
                </div>
              </div>

              {/* Imagen del Producto */}
              <div>
                <ProductImageUpload 
                  onImageUploaded={handleImageUploaded}
                  currentImageUrl={formData.imageUrl}
                  onImageRemoved={handleImageRemoved}
                />
              </div>

              {/* Especificaciones Técnicas */}
              <div>
                <Label htmlFor="technicalSpecs" className="text-black font-medium">Especificaciones Técnicas</Label>
                <Textarea
                  id="technicalSpecs"
                  name="technicalSpecs"
                  placeholder="Material: 100% Algodón&#10;Peso: 180g/m²&#10;Cuidado: Lavado a máquina 30°C"
                  value={formData.technicalSpecs}
                  onChange={handleInputChange}
                  className="min-h-[120px] mt-1"
                />
              </div>

              {/* Variantes usando ProductVariants */}
              <ProductVariants 
                variants={variants} 
                onVariantsChange={handleVariantsChange} 
              />

              {/* Ficha Técnica */}
              <div>
                <TechnicalFileUpload files={technicalFiles} onFilesChange={handleFilesChange} />
              </div>

              {/* Botones */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Button type="button" variant="outline" onClick={handleClose} className="px-8">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="px-8 bg-blue-600 hover:bg-blue-700">
                  {loading ? 'Creando...' : 'Crear Producto'}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="shopify" className="space-y-6 mt-6">
            <ShopifyProductImport onProductSelect={handleShopifyImport} />
            <div className="flex justify-end pt-6 border-t">
              <Button type="button" variant="outline" onClick={handleClose} className="px-8">
                Cerrar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProductForm;
