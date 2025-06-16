
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Upload, Package, ExternalLink, FileText, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ShopifyProductImport from './ShopifyProductImport';
import ProductVariants from './ProductVariants';
import TechnicalFileUpload from './TechnicalFileUpload';

interface ShopifyProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  variants: Array<{ size: string; color: string; price: string; sku: string }>;
  image?: string;
  sku?: string;
  category?: string;
  brand?: string;
  specifications?: string;
  status: 'active' | 'draft';
}

const ProductForm = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState('import');
  const [selectedShopifyProduct, setSelectedShopifyProduct] = useState<ShopifyProduct | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const { toast } = useToast();
  
  const [productData, setProductData] = useState({
    name: '',
    description: '',
    specifications: '',
    category: '',
    brand: '',
    sku: ''
  });
  
  const [variants, setVariants] = useState([
    { size: 'S', color: '', price: '', sku: '' },
    { size: 'M', color: '', price: '', sku: '' },
    { size: 'L', color: '', price: '', sku: '' }
  ]);

  const [technicalFiles, setTechnicalFiles] = useState<File[]>([]);

  const handleInputChange = (field: string, value: string) => {
    setProductData(prev => ({ ...prev, [field]: value }));
  };

  const handleShopifyProductSelect = (product: ShopifyProduct) => {
    console.log('Producto seleccionado de Shopify:', product);
    setSelectedShopifyProduct(product);
  };

  const createProductFromShopify = async () => {
    if (!selectedShopifyProduct) return;

    setIsCreatingProduct(true);
    try {
      console.log('Creando producto desde Shopify:', selectedShopifyProduct);

      // Crear el producto principal
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert([
          {
            name: selectedShopifyProduct.name,
            description: selectedShopifyProduct.description,
            sku: selectedShopifyProduct.sku || `SHOPIFY-${selectedShopifyProduct.id}`,
            category: selectedShopifyProduct.category || '',
            base_price: parseFloat(selectedShopifyProduct.price) || 0,
            image_url: selectedShopifyProduct.image || '',
            status: 'active'
          }
        ])
        .select()
        .single();

      if (productError) {
        console.error('Error creando producto:', productError);
        throw productError;
      }

      console.log('Producto creado:', product);

      // Crear las variantes del producto
      if (selectedShopifyProduct.variants && selectedShopifyProduct.variants.length > 0) {
        const variantsToInsert = selectedShopifyProduct.variants.map(variant => ({
          product_id: product.id,
          size: variant.size || '',
          color: variant.color || '',
          sku_variant: variant.sku || `${product.sku}-${variant.size || 'DEFAULT'}`,
          additional_price: parseFloat(variant.price) - parseFloat(selectedShopifyProduct.price) || 0,
          stock_quantity: 0
        }));

        console.log('Creando variantes:', variantsToInsert);

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);

        if (variantsError) {
          console.error('Error creando variantes:', variantsError);
          throw variantsError;
        }

        console.log('Variantes creadas exitosamente');
      }

      toast({
        title: "¡Producto creado exitosamente!",
        description: `${selectedShopifyProduct.name} ha sido importado desde Shopify con ${selectedShopifyProduct.variants.length} variantes.`,
      });

      onClose();

    } catch (error) {
      console.error('Error creando producto desde Shopify:', error);
      toast({
        title: "Error al crear el producto",
        description: "Hubo un problema al importar el producto desde Shopify. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting product:', { productData, variants, technicalFiles });
    // Aquí se implementará la lógica de envío para productos creados manualmente
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl font-semibold text-black">Agregar Producto</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-xl">
              <TabsTrigger value="import" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Importar de Shopify
              </TabsTrigger>
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Crear Nuevo
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="import" className="mt-6">
              {!selectedShopifyProduct ? (
                <ShopifyProductImport onProductSelect={handleShopifyProductSelect} />
              ) : (
                <div className="space-y-6">
                  <Card className="border border-green-200 bg-green-50">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {selectedShopifyProduct.image && (
                          <div className="flex-shrink-0">
                            <img 
                              src={selectedShopifyProduct.image} 
                              alt={selectedShopifyProduct.name}
                              className="w-20 h-20 object-cover rounded-lg border"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-medium text-black">{selectedShopifyProduct.name}</h3>
                            <Badge 
                              variant={selectedShopifyProduct.status === 'active' ? 'default' : 'secondary'}
                              className={selectedShopifyProduct.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                            >
                              {selectedShopifyProduct.status === 'active' ? 'Activo' : 'Borrador'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">SKU:</span>
                              <span className="ml-2 text-gray-600">{selectedShopifyProduct.sku || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Precio base:</span>
                              <span className="ml-2 text-gray-600">${selectedShopifyProduct.price}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Categoría:</span>
                              <span className="ml-2 text-gray-600">{selectedShopifyProduct.category || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Marca:</span>
                              <span className="ml-2 text-gray-600">{selectedShopifyProduct.brand || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="mb-4">
                            <span className="font-medium text-gray-700">Variantes ({selectedShopifyProduct.variants.length}):</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {selectedShopifyProduct.variants.map((variant, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {variant.size} {variant.color && `- ${variant.color}`} (${variant.price})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-6 pt-4 border-t border-green-200">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedShopifyProduct(null)}
                          className="text-gray-600"
                        >
                          Seleccionar Otro Producto
                        </Button>
                        <Button
                          onClick={createProductFromShopify}
                          disabled={isCreatingProduct}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isCreatingProduct ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Confirmar e Importar Producto
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="create" className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Información básica */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-black">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-black">Nombre del Producto *</Label>
                      <Input
                        id="name"
                        value={productData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Ej: Camiseta Básica Algodón"
                        required
                        className="text-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku" className="text-black">SKU</Label>
                      <Input
                        id="sku"
                        value={productData.sku}
                        onChange={(e) => handleInputChange('sku', e.target.value)}
                        placeholder="Ej: CAM-001"
                        className="text-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-black">Categoría</Label>
                      <Input
                        id="category"
                        value={productData.category}
                        onChange={(e) => handleInputChange('category', e.target.value)}
                        placeholder="Ej: Ropa, Accesorios"
                        className="text-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand" className="text-black">Marca</Label>
                      <Input
                        id="brand"
                        value={productData.brand}
                        onChange={(e) => handleInputChange('brand', e.target.value)}
                        placeholder="Ej: Tu Marca"
                        className="text-black"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-black">Descripción</Label>
                    <Textarea
                      id="description"
                      value={productData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe las características principales del producto..."
                      rows={3}
                      className="text-black"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="specifications" className="text-black">Especificaciones Técnicas</Label>
                    <Textarea
                      id="specifications"
                      value={productData.specifications}
                      onChange={(e) => handleInputChange('specifications', e.target.value)}
                      placeholder="Material: 100% Algodón&#10;Peso: 180g/m²&#10;Cuidado: Lavado a máquina 30°C"
                      rows={4}
                      className="text-black"
                    />
                  </div>
                </div>

                <Separator />

                {/* Variantes y Tallas */}
                <ProductVariants variants={variants} onVariantsChange={setVariants} />

                <Separator />

                {/* Ficha Técnica */}
                <TechnicalFileUpload files={technicalFiles} onFilesChange={setTechnicalFiles} />

                <div className="flex justify-end space-x-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    className="text-black border-gray-300"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Crear Producto
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductForm;
