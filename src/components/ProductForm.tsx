
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Upload, Package, ExternalLink, FileText } from 'lucide-react';
import ShopifyProductImport from './ShopifyProductImport';
import ProductVariants from './ProductVariants';
import TechnicalFileUpload from './TechnicalFileUpload';

const ProductForm = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState('import');
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting product:', { productData, variants, technicalFiles });
    // Aquí se implementará la lógica de envío
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
            <TabsList className="grid w-full grid-cols-2">
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
              <ShopifyProductImport onProductSelect={(product) => {
                setProductData({
                  name: product.name,
                  description: product.description,
                  specifications: product.specifications || '',
                  category: product.category || '',
                  brand: product.brand || '',
                  sku: product.sku || ''
                });
                setVariants(product.variants || variants);
              }} />
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
