import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Upload, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductVariants from '@/components/ProductVariants';
import TechnicalFileUpload from '@/components/TechnicalFileUpload';
import ShopifyProductImport from '@/components/ShopifyProductImport';

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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    basePrice: 0,
    imageUrl: '',
    sku: '',
    category: '',
    technicalFileUrl: ''
  });

  const [variants, setVariants] = useState<any[]>([]);
  const [technicalFile, setTechnicalFile] = useState<File | null>(null);
  const [showShopifyImport, setShowShopifyImport] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (file: File | null) => {
    setTechnicalFile(file);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Subir primero el archivo técnico si existe
      let technicalFileUrl = null;
      if (technicalFile) {
        const { data, error } = await supabase.storage
          .from('product-files')
          .upload(`${formData.sku}/${technicalFile.name}`, technicalFile, {
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
            sku: formData.sku,
            category: formData.category,
            base_price: formData.basePrice,
            image_url: formData.imageUrl,
            technical_file_url: technicalFileUrl
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

      onSuccess();

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
      category: '',
      technicalFileUrl: ''
    });
    
    setVariants(product.variants.map(variant => ({
      size: variant.size,
      color: variant.color,
      skuVariant: variant.sku,
      additionalPrice: 0,
      stockQuantity: variant.stock_quantity
    })));
    
    setShowShopifyImport(false);
  };

  return (
    <Card className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-black">Nuevo Producto</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Información básica */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Nombre del Producto</Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input
              type="text"
              id="sku"
              name="sku"
              value={formData.sku}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="basePrice">Precio Base</Label>
            <Input
              type="number"
              id="basePrice"
              name="basePrice"
              value={formData.basePrice}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="category">Categoría</Label>
            <Input
              type="text"
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            className="min-h-[80px]"
          />
        </div>

        <div>
          <Label htmlFor="imageUrl">URL de la Imagen</Label>
          <Input
            type="url"
            id="imageUrl"
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleInputChange}
          />
        </div>

        {/* Subida de archivo técnico */}
        <TechnicalFileUpload onFileChange={handleFileChange} />

        {/* Sección de variantes */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-black">Variantes</h3>
          {variants.map((variant, index) => (
            <div key={index} className="grid grid-cols-3 md:grid-cols-5 gap-4 items-center">
              <div>
                <Label htmlFor={`size-${index}`}>Talla</Label>
                <Input
                  type="text"
                  id={`size-${index}`}
                  value={variant.size}
                  onChange={(e) => updateVariant(index, 'size', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`color-${index}`}>Color</Label>
                <Input
                  type="text"
                  id={`color-${index}`}
                  value={variant.color}
                  onChange={(e) => updateVariant(index, 'color', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`skuVariant-${index}`}>SKU Variante</Label>
                <Input
                  type="text"
                  id={`skuVariant-${index}`}
                  value={variant.skuVariant}
                  onChange={(e) => updateVariant(index, 'skuVariant', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`additionalPrice-${index}`}>Precio Adicional</Label>
                <Input
                  type="number"
                  id={`additionalPrice-${index}`}
                  value={variant.additionalPrice}
                  onChange={(e) => updateVariant(index, 'additionalPrice', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`stockQuantity-${index}`}>Stock</Label>
                <Input
                  type="number"
                  id={`stockQuantity-${index}`}
                  value={variant.stockQuantity}
                  onChange={(e) => updateVariant(index, 'stockQuantity', e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeVariant(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addVariant}>
            Añadir Variante
          </Button>
        </div>

        {/* Importar desde Shopify */}
        <div>
          <Button type="button" variant="secondary" onClick={() => setShowShopifyImport(true)}>
            Importar desde Shopify
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Crear Producto'}
          </Button>
        </div>
      </form>

      {/* Modal de importación desde Shopify */}
      {showShopifyImport && (
        <ShopifyProductImport
          onProductSelect={handleShopifyImport}
        />
      )}
    </Card>
  );
};

export default ProductForm;
