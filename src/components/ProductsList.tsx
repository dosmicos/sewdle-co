import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Package, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductEditModal from '@/components/ProductEditModal';
import ShopifyDiagnosticTool from '@/components/supplies/ShopifyDiagnosticTool';
import SkuCorrectionTool from '@/components/SkuCorrectionTool';
import ShopifySkuAssignment from '@/components/ShopifySkuAssignment';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface ProductsListProps {
  products: Product[];
  loading: boolean;
  error: string | null;
  onProductUpdate?: () => void;
}

const ProductsList = ({ products, loading, error, onProductUpdate }: ProductsListProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const handleEditProduct = (product: Product) => {
    setProductToEdit(product);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setProductToEdit(null);
    if (onProductUpdate) {
      onProductUpdate();
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    try {
      // Primero eliminar las variantes del producto
      const { error: variantsError } = await supabase
        .from('product_variants')
        .delete()
        .eq('product_id', productToDelete.id);

      if (variantsError) {
        console.error('Error deleting product variants:', variantsError);
        throw variantsError;
      }

      // Luego eliminar el producto
      const { error: productError } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete.id);

      if (productError) {
        console.error('Error deleting product:', productError);
        throw productError;
      }

      toast({
        title: "Producto eliminado",
        description: `${productToDelete.name} ha sido eliminado exitosamente.`,
      });

      // Actualizar la lista de productos
      if (onProductUpdate) {
        onProductUpdate();
      }

    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error al eliminar producto",
        description: error.message || "Hubo un problema al eliminar el producto.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-black">Error al cargar productos</h3>
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* Herramientas de diagnóstico y corrección */}
      <div className="mb-6 space-y-4">
        {/* Nueva herramienta de asignación de SKUs */}
        <ShopifySkuAssignment />
        
        {/* Herramienta de corrección de SKUs */}
        <SkuCorrectionTool />
        
        {/* Herramienta de diagnóstico */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold mb-2 text-black">Diagnóstico de Shopify</h3>
          </div>
          <Button
            onClick={() => setShowDiagnostic(!showDiagnostic)}
            variant="outline"
            className="border-blue-500 text-blue-600 hover:bg-blue-50"
          >
            {showDiagnostic ? 'Ocultar' : 'Mostrar'} Diagnóstico
          </Button>
        </div>
        
        {showDiagnostic && <ShopifyDiagnosticTool />}
      </div>

      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay productos registrados</h3>
            <p className="text-gray-600 mb-4">Agrega productos para comenzar a crear órdenes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                {product.image_url && (
                  <div className="mb-4">
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-48 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-black text-lg">{product.name}</h3>
                    <Badge variant="outline" className="ml-2">
                      {product.category || 'Sin categoría'}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">SKU:</span> {product.sku}
                    {/* Indicador visual de SKU artificial */}
                    {product.sku.includes('-') && product.sku.split('-').length > 2 && (
                      <Badge variant="outline" className="ml-2 text-xs border-orange-500 text-orange-700">
                        Artificial
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-lg font-semibold text-green-600">
                    ${product.base_price.toLocaleString('es-CO')}
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditProduct(product)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteClick(product)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de edición */}
      {productToEdit && (
        <ProductEditModal
          product={productToEdit}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setProductToEdit(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Modal de confirmación para eliminar */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar "{productToDelete?.name}"? 
              Esta acción no se puede deshacer y también eliminará todas las variantes del producto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProductsList;
