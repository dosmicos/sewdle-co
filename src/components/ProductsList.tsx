
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Edit, Trash2, Package, Power } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ProductEditModal from '@/components/ProductEditModal';
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
  showDiagnosticTools?: boolean;
  showInactive?: boolean;
}

const ProductsList = ({ 
  products, 
  loading, 
  error, 
  onProductUpdate,
  showDiagnosticTools = true,
  showInactive = false
}: ProductsListProps) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
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

  const handleStatusToggle = async (product: Product) => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active';
    setUpdatingStatus(product.id);
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ status: newStatus })
        .eq('id', product.id);

      if (error) {
        console.error('Error updating product status:', error);
        throw error;
      }

      toast({
        title: newStatus === 'active' ? "Producto activado" : "Producto desactivado",
        description: `${product.name} ahora está ${newStatus === 'active' ? 'activo' : 'inactivo'}.`,
      });

      // Actualizar la lista de productos
      if (onProductUpdate) {
        onProductUpdate();
      }

    } catch (error: unknown) {
      console.error('Error updating product status:', error);
      toast({
        title: "Error al cambiar estado",
        description: error.message || "Hubo un problema al cambiar el estado del producto.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
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

    } catch (error: unknown) {
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
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay productos registrados</h3>
            <p className="text-gray-600 mb-4">Agrega productos para comenzar a crear órdenes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header de la tabla */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium text-gray-700">
                <div className="col-span-3">Producto</div>
                <div className="col-span-1">Estado</div>
                <div className="col-span-1">Activo</div>
                <div className="col-span-2">SKU</div>
                <div className="col-span-1">Precio</div>
                <div className="col-span-2">Categoría</div>
                <div className="col-span-2">Acciones</div>
              </div>
            </div>

            {/* Filas de productos */}
            <div className="divide-y divide-gray-100">
              {products.map((product) => (
                <div key={product.id} className={`px-6 py-4 hover:bg-gray-50 transition-colors ${product.status === 'inactive' ? 'opacity-60 bg-gray-50/50' : ''}`}>
                  <div className="grid grid-cols-12 gap-4 items-center">

                    {/* Producto (imagen + nombre) */}
                    <div className="col-span-3 flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {product.description || 'Sin descripción'}
                        </p>
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="col-span-1">
                      <Badge 
                        variant={product.status === 'active' ? 'default' : 'secondary'} 
                        className={product.status === 'active' 
                          ? "bg-green-100 text-green-800 border-green-200" 
                          : "bg-red-100 text-red-800 border-red-200"
                        }
                      >
                        {product.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>

                    {/* Toggle Activo/Inactivo */}
                    <div className="col-span-1">
                      <div className="flex items-center justify-center">
                        <Switch
                          checked={product.status === 'active'}
                          onCheckedChange={() => handleStatusToggle(product)}
                          disabled={updatingStatus === product.id}
                          className="data-[state=checked]:bg-green-600"
                        />
                        {updatingStatus === product.id && (
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin ml-2"></div>
                        )}
                      </div>
                    </div>

                    {/* SKU */}
                    <div className="col-span-2">
                      <div className="text-sm text-gray-900 font-mono">{product.sku}</div>
                      {product.sku.includes('-') && product.sku.split('-').length > 2 && (
                        <Badge variant="outline" className="text-xs border-orange-500 text-orange-700 mt-1">
                          Artificial
                        </Badge>
                      )}
                    </div>

                    {/* Precio */}
                    <div className="col-span-1">
                      <div className="text-sm font-medium text-green-600">
                        ${product.base_price.toLocaleString('es-CO')}
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-xs">
                        {product.category || 'Sin categoría'}
                      </Badge>
                    </div>

                    {/* Acciones */}
                    <div className="col-span-2 flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditProduct(product)}
                        title="Editar producto"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteClick(product)}
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
