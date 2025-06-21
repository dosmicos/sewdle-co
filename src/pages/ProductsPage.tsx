import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search, RefreshCw } from 'lucide-react';
import ProductForm from '@/components/ProductForm';
import ProductsList from '@/components/ProductsList';
import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const ProductsPage = () => {
  const [showProductForm, setShowProductForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);
  const { products, loading, error, refetch } = useProducts();
  const { toast } = useToast();

  // Filtrar productos basado en el término de búsqueda
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleProductFormSuccess = () => {
    setShowProductForm(false);
    refetch(); // Recargar productos cuando se cierra el formulario
  };

  const handleProductUpdate = () => {
    refetch(); // Recargar productos cuando se actualiza/elimina un producto
  };

  const updateStockFromShopify = async () => {
    setUpdatingStock(true);
    try {
      console.log('Updating stock from Shopify for all products');

      // Obtener productos de Shopify
      const { data, error } = await supabase.functions.invoke('shopify-products', {
        body: { searchTerm: '' }
      });

      if (error) {
        console.error('Error calling shopify-products function:', error);
        throw new Error(error.message || 'Error en la conexión con Shopify');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.products) {
        throw new Error('Respuesta inválida de Shopify');
      }

      let updatedCount = 0;

      // Para cada producto local, buscar coincidencia en Shopify y actualizar stock
      for (const localProduct of products) {
        // Buscar producto en Shopify por nombre o SKU similar
        const shopifyProduct = data.products.find((sp: any) => 
          sp.title.toLowerCase().includes(localProduct.name.toLowerCase()) ||
          localProduct.name.toLowerCase().includes(sp.title.toLowerCase()) ||
          sp.variants?.some((v: any) => v.sku && localProduct.sku.includes(v.sku.substring(0, 5)))
        );

        if (shopifyProduct && shopifyProduct.variants) {
          // Actualizar variantes del producto local
          const { data: localVariants } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', localProduct.id);

          if (localVariants) {
            for (const localVariant of localVariants) {
              // Buscar variante correspondiente en Shopify
              const shopifyVariant = shopifyProduct.variants.find((sv: any) => {
                const sizeMatch = !localVariant.size || sv.title.toLowerCase().includes(localVariant.size.toLowerCase());
                const colorMatch = !localVariant.color || sv.title.toLowerCase().includes(localVariant.color.toLowerCase());
                return sizeMatch && colorMatch;
              }) || shopifyProduct.variants[0]; // Usar primera variante si no hay coincidencia exacta

              if (shopifyVariant) {
                const newStock = shopifyVariant.stock_quantity || shopifyVariant.inventory_quantity || 0;
                
                // Actualizar stock en la base de datos
                await supabase
                  .from('product_variants')
                  .update({ stock_quantity: newStock })
                  .eq('id', localVariant.id);

                console.log(`Updated stock for ${localProduct.name} - ${localVariant.size || 'Default'}: ${newStock}`);
              }
            }
            updatedCount++;
          }
        }
      }

      toast({
        title: "Stock actualizado",
        description: `Se actualizó el stock de ${updatedCount} productos desde Shopify.`,
      });

      // Recargar productos para mostrar los cambios
      refetch();

    } catch (error: any) {
      console.error('Error updating stock from Shopify:', error);
      toast({
        title: "Error al actualizar stock",
        description: error.message || "Hubo un problema al sincronizar con Shopify.",
        variant: "destructive",
      });
    } finally {
      setUpdatingStock(false);
    }
  };

  return (
    <>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">Productos</h1>
            <p className="text-gray-600">Catálogo de productos y plantillas</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={updateStockFromShopify}
              disabled={updatingStock}
              variant="outline"
              className="font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${updatingStock ? 'animate-spin' : ''}`} />
              {updatingStock ? 'Actualizando...' : 'Actualizar Stock'}
            </Button>
            <Button 
              onClick={() => setShowProductForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 bg-white border border-gray-300 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
            />
          </div>
        </div>

        {/* Lista de productos */}
        <ProductsList 
          products={filteredProducts} 
          loading={loading} 
          error={error}
          onProductUpdate={handleProductUpdate}
        />
      </div>

      {showProductForm && (
        <ProductForm onSuccess={handleProductFormSuccess} />
      )}
    </>
  );
};

export default ProductsPage;
