import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, RefreshCw, Package, Settings, Wifi, WifiOff, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import ProductForm from '@/components/ProductForm';
import ProductsList from '@/components/ProductsList';
import ShopifySkuAssignment from '@/components/ShopifySkuAssignment';
import SkuCorrectionTool from '@/components/SkuCorrectionTool';
import ShopifyDiagnosticTool from '@/components/supplies/ShopifyDiagnosticTool';
import { VariantSyncManager } from '@/components/VariantSyncManager';

import { useProducts } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
const ProductsPage = () => {
  const [showProductForm, setShowProductForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStock, setUpdatingStock] = useState(false);
  const [activeTab, setActiveTab] = useState('catalog');
  const {
    products,
    loading,
    error,
    lastUpdated,
    autoRefreshEnabled,
    syncStatus,
    refetch,
    setAutoRefreshEnabled,
    refreshNow
  } = useProducts();
  const {
    toast
  } = useToast();

  // Filtrar productos basado en el término de búsqueda
  const filteredProducts = products.filter(product => product.name.toLowerCase().includes(searchTerm.toLowerCase()) || product.sku.toLowerCase().includes(searchTerm.toLowerCase()) || product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()));
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
      console.log('🔄 Iniciando actualización de stock desde Shopify...');
      console.log('📅 Timestamp:', new Date().toISOString());

      // Obtener productos de Shopify con logging mejorado
      console.log('📡 Invocando función shopify-products...');
      const startTime = Date.now();
      
      const {
        data,
        error
      } = await supabase.functions.invoke('shopify-products', {
        body: {
          searchTerm: ''
        }
      });
      
      const callDuration = Date.now() - startTime;
      console.log(`⏱️ Llamada a edge function completada en ${callDuration}ms`);
      
      if (error) {
        console.error('❌ Error llamando función shopify-products:', error);
        throw new Error(error.message || 'Error en la conexión con Shopify');
      }
      if (data?.error) {
        console.error('❌ Error de Shopify:', data.error);
        throw new Error(data.error);
      }
      if (!data?.products) {
        console.error('❌ Respuesta inválida de Shopify:', data);
        console.log('📊 Datos recibidos completos:', JSON.stringify(data, null, 2));
        throw new Error('Respuesta inválida de Shopify');
      }

      // Validar metadata si existe
      if (data._metadata) {
        console.log('✅ Metadata de respuesta:', data._metadata);
        const responseAge = Date.now() - new Date(data._metadata.timestamp).getTime();
        console.log(`⏱️ Edad de datos: ${Math.round(responseAge/1000)} segundos`);
        
        if (responseAge > 60000) { // Más de 1 minuto
          console.warn('⚠️ Los datos parecen antiguos (>1 minuto)');
        }
      }

      console.log(`📦 Productos obtenidos de Shopify: ${data.products.length}`);
      
      // Obtener todas las variantes locales
      const { data: allLocalVariants, error: variantsError } = await supabase
        .from('product_variants')
        .select(`
          id,
          sku_variant,
          stock_quantity,
          product_id,
          size,
          color,
          products!inner(name)
        `);

      if (variantsError) {
        console.error('❌ Error obteniendo variantes locales:', variantsError);
        throw new Error('Error obteniendo variantes locales');
      }

      console.log(`🏠 Variantes locales encontradas: ${allLocalVariants?.length || 0}`);

      let updatedCount = 0;
      let matchedCount = 0;
      let noChangeCount = 0;
      let notFoundCount = 0;
      const updateDetails: string[] = [];

      // Crear un mapa de todas las variantes de Shopify para búsqueda eficiente
      const shopifyVariantsMap = new Map();
      let totalShopifyVariants = 0;
      
      data.products.forEach((product: any) => {
        if (product.variants) {
          product.variants.forEach((variant: any) => {
            if (variant.sku) {
              shopifyVariantsMap.set(variant.sku, {
                ...variant,
                productTitle: product.title
              });
              totalShopifyVariants++;
              
              // Log especial para variantes problemáticas
              if (variant.sku === '46092135956715' || variant.sku === '46581502771435') {
                console.log(`🎯 VARIANT DEBUG - SKU: ${variant.sku}, Stock: ${variant.inventory_quantity || variant.stock_quantity || 0}`);
              }
            }
          });
        }
      });

      console.log(`🛍️ Total de variantes en Shopify: ${totalShopifyVariants}`);
      console.log(`🔍 Ejemplo de SKUs en Shopify:`, Array.from(shopifyVariantsMap.keys()).slice(0, 5));

      // Iterar sobre cada variante local
      for (const localVariant of allLocalVariants || []) {
        if (!localVariant.sku_variant) {
          console.log(`⚠️ Variante sin SKU: ${localVariant.products.name} - ${localVariant.size || 'Default'}`);
          continue;
        }

        // Buscar variante exacta por SKU
        const shopifyVariant = shopifyVariantsMap.get(localVariant.sku_variant);
        
        if (shopifyVariant) {
          matchedCount++;
          const shopifyStock = shopifyVariant.inventory_quantity || shopifyVariant.stock_quantity || 0;
          const currentStock = localVariant.stock_quantity || 0;

          console.log(`🔍 Coincidencia encontrada:`);
          console.log(`   📋 SKU: ${localVariant.sku_variant}`);
          console.log(`   🏷️ Producto: ${localVariant.products.name}`);
          console.log(`   📦 Stock actual: ${currentStock} -> Shopify: ${shopifyStock}`);

          // Solo actualizar si el stock es diferente
          if (currentStock !== shopifyStock) {
            console.log(`🔄 Actualizando ${localVariant.sku_variant}: ${currentStock} → ${shopifyStock}`);
            
            const { error: updateError } = await supabase
              .from('product_variants')
              .update({ stock_quantity: shopifyStock })
              .eq('id', localVariant.id);

            if (updateError) {
              console.error(`❌ Error actualizando ${localVariant.sku_variant}:`, updateError);
            } else {
              updatedCount++;
              const detail = `${localVariant.sku_variant}: ${currentStock} → ${shopifyStock}`;
              updateDetails.push(detail);
              console.log(`✅ Actualizado: ${detail}`);
            }
          } else {
            console.log(`ℹ️ Sin cambios para ${localVariant.sku_variant} (ya tiene ${shopifyStock})`);
            noChangeCount++;
          }
        } else {
          console.log(`⚠️ No encontrado en Shopify: ${localVariant.sku_variant} (${localVariant.products.name})`);
          notFoundCount++;
        }
      }

      console.log(`📊 Resumen completo de actualización:`);
      console.log(`   🔗 Coincidencias encontradas: ${matchedCount}`);
      console.log(`   ✅ Variantes actualizadas: ${updatedCount}`);
      console.log(`   ℹ️ Sin cambios: ${noChangeCount}`);
      console.log(`   ⚠️ No encontradas: ${notFoundCount}`);
      console.log(`   📝 Detalles de actualizaciones:`, updateDetails);

      const message = `Actualizadas: ${updatedCount}, Sin cambios: ${noChangeCount}, No encontradas: ${notFoundCount}`;
      
      toast({
        title: "Stock actualizado",
        description: message
      });

      // Recargar productos para mostrar los cambios
      refetch();
    } catch (error: any) {
      console.error('💥 Error updating stock from Shopify:', error);
      toast({
        title: "Error al actualizar stock",
        description: error.message || "Hubo un problema al sincronizar con Shopify.",
        variant: "destructive"
      });
    } finally {
      setUpdatingStock(false);
    }
  };
  return <>
      <div className="p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black">Productos</h1>
            <p className="text-gray-600">Gestión de catálogo y sincronización automática con Shopify</p>
          </div>
          <div className="flex gap-3">

            {/* Toggle auto-refresh */}
            <Button
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              variant="outline"
              className="font-medium rounded-xl px-4 py-3 transition-all duration-200 active:scale-[0.98]"
            >
              {autoRefreshEnabled ? (
                <ToggleRight className="w-4 h-4 mr-2 text-green-500" />
              ) : (
                <ToggleLeft className="w-4 h-4 mr-2 text-gray-400" />
              )}
              Auto-sync
            </Button>
            
            <Button onClick={() => setShowProductForm(true)} className="text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98] bg-[#ff5c02]">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Sistema de pestañas */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="catalog" className="flex items-center space-x-2">
              <Package className="w-4 h-4" />
              <span>Catálogo</span>
            </TabsTrigger>
            <TabsTrigger value="shopify-sync" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Shopify Sync</span>
            </TabsTrigger>
            <TabsTrigger value="variant-sync" className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4" />
              <span>Variantes</span>
            </TabsTrigger>
          </TabsList>

           <TabsContent value="catalog" className="space-y-6 mt-6">
            {/* Información de sincronización automática */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              {lastUpdated && (
                <p className="text-xs text-green-700">
                  Última actualización: {lastUpdated.toLocaleString('es-ES')}
                </p>
              )}
            </div>

            {/* Barra de búsqueda para catálogo */}
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input type="text" placeholder="Buscar productos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 bg-white border border-gray-300 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200" />
              </div>
            </div>

            {/* Lista de productos simplificada */}
            <ProductsList products={filteredProducts} loading={loading} error={error} onProductUpdate={handleProductUpdate} showDiagnosticTools={false} />
          </TabsContent>

          <TabsContent value="shopify-sync" className="space-y-6 mt-6">
            <div className="space-y-6">
              {/* Descripción de la sección */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Herramientas de Sincronización con Shopify</h3>
                <p className="text-sm text-blue-800">
                  Conjunto de herramientas para gestionar la sincronización y corrección de productos entre tu sistema local y Shopify.
                  Configura webhooks para actualizaciones automáticas de inventario en tiempo real.
                </p>
              </div>

              {/* Actualización Manual de Inventario */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-amber-900">Actualización Manual de Inventario</h3>
                    <p className="text-sm text-amber-800 mt-1">
                      Sincroniza manualmente el stock de todos los productos desde Shopify
                    </p>
                  </div>
                  <Button
                    onClick={updateStockFromShopify}
                    disabled={updatingStock}
                    variant="outline"
                    className="min-w-[160px] font-medium"
                  >
                    {updatingStock ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Actualizando...
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4 mr-2" />
                        Actualizar Inventario
                      </>
                    )}
                  </Button>
                </div>
                <div className="text-xs text-amber-700 bg-amber-100 p-2 rounded">
                  <strong>Nota:</strong> Esta función obtiene el stock actual de todos los productos desde Shopify 
                  y actualiza las cantidades en tu catálogo local. Útil para ventas pasadas que no activaron webhooks.
                </div>
              </div>


              {/* Herramientas organizadas */}
              <div className="grid gap-6">
                {/* Asignación Inteligente de SKUs */}
                <ShopifySkuAssignment />
                
                {/* Corrección Inteligente de SKUs */}
                <SkuCorrectionTool />
                
                {/* Diagnóstico de Shopify */}
                <ShopifyDiagnosticTool />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="variant-sync" className="space-y-6 mt-6">
            <VariantSyncManager />
          </TabsContent>
        </Tabs>
      </div>

      {showProductForm && <ProductForm onSuccess={handleProductFormSuccess} />}
    </>;
};
export default ProductsPage;