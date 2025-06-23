
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSkuCorrection = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const correctArtificialSkus = async () => {
    setLoading(true);
    try {
      console.log('🔧 Iniciando corrección inteligente de SKUs...');

      // 1. Obtener todos los productos de Shopify
      const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('shopify-products', {
        body: { searchTerm: '' }
      });

      if (shopifyError || !shopifyData?.products) {
        throw new Error('Error obteniendo productos de Shopify');
      }

      console.log(`📦 Obtenidos ${shopifyData.products.length} productos de Shopify`);

      // 2. Crear mapas optimizados de productos Shopify
      const shopifyProductsMap = new Map();
      const shopifyVariantsMap = new Map();
      
      shopifyData.products.forEach((product: any) => {
        // Mapear por título normalizado
        const normalizedTitle = product.title.toLowerCase().trim();
        shopifyProductsMap.set(normalizedTitle, product);
        
        // Mapear variantes por características
        product.variants?.forEach((variant: any) => {
          const variantKey = `${normalizedTitle}|${(variant.option1 || '').toLowerCase()}|${(variant.option2 || '').toLowerCase()}`;
          shopifyVariantsMap.set(variantKey, variant);
        });
      });

      console.log(`🗺️ Creados mapas: ${shopifyProductsMap.size} productos, ${shopifyVariantsMap.size} variantes`);

      // 3. Obtener productos locales que necesitan corrección
      const { data: localProducts, error: localError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          product_variants (
            id,
            sku_variant,
            size,
            color
          )
        `);

      if (localError) {
        throw new Error(`Error obteniendo productos locales: ${localError.message}`);
      }

      console.log(`🏠 Obtenidos ${localProducts?.length || 0} productos locales`);

      let correctedProducts = 0;
      let correctedVariants = 0;
      let skippedProducts = 0;

      // 4. Procesar cada producto local
      for (const localProduct of localProducts || []) {
        console.log(`\n🔍 Procesando: "${localProduct.name}"`);
        
        // Buscar producto en Shopify por título
        const normalizedLocalName = localProduct.name.toLowerCase().trim();
        const shopifyProduct = shopifyProductsMap.get(normalizedLocalName);
        
        if (!shopifyProduct) {
          console.log(`❌ No encontrado en Shopify: "${localProduct.name}"`);
          skippedProducts++;
          continue;
        }

        console.log(`✅ Encontrado en Shopify: "${shopifyProduct.title}"`);

        // 5. Corregir SKU del producto principal
        let needsProductUpdate = false;
        let newProductSku = localProduct.sku;

        // Detectar si el SKU actual es artificial
        const hasArtificialSku = localProduct.sku.startsWith('SHOPIFY-') || 
                                localProduct.sku.includes('-') && 
                                (localProduct.sku.match(/-/g) || []).length >= 2;

        if (hasArtificialSku && shopifyProduct.variants?.length > 0) {
          // Usar el SKU de la primera variante como SKU principal
          const mainVariant = shopifyProduct.variants[0];
          newProductSku = mainVariant.sku || mainVariant.id.toString();
          
          if (newProductSku !== localProduct.sku) {
            needsProductUpdate = true;
            console.log(`📝 SKU producto: "${localProduct.sku}" → "${newProductSku}"`);
          }
        }

        // 6. Corregir SKUs de variantes usando mapeo inteligente
        let variantUpdates = 0;
        if (localProduct.product_variants?.length > 0) {
          for (const localVariant of localProduct.product_variants) {
            // Crear clave para buscar la variante en Shopify
            const variantKey = `${normalizedLocalName}|${(localVariant.size || '').toLowerCase()}|${(localVariant.color || '').toLowerCase()}`;
            const shopifyVariant = shopifyVariantsMap.get(variantKey);

            if (shopifyVariant) {
              const correctSku = shopifyVariant.sku || shopifyVariant.id.toString();
              
              // Detectar si el SKU de la variante es artificial
              const hasArtificialVariantSku = localVariant.sku_variant.startsWith('SHOPIFY-') ||
                                            localVariant.sku_variant.includes('-') && 
                                            (localVariant.sku_variant.match(/-/g) || []).length >= 2;
              
              if (hasArtificialVariantSku && correctSku !== localVariant.sku_variant) {
                const { error: updateVariantError } = await supabase
                  .from('product_variants')
                  .update({ sku_variant: correctSku })
                  .eq('id', localVariant.id);
                
                if (updateVariantError) {
                  console.error(`❌ Error actualizando variante ${localVariant.id}:`, updateVariantError);
                } else {
                  variantUpdates++;
                  console.log(`📝 SKU variante (${localVariant.size}/${localVariant.color}): "${localVariant.sku_variant}" → "${correctSku}"`);
                }
              } else {
                console.log(`✓ Variante ya tiene SKU correcto: ${localVariant.sku_variant}`);
              }
            } else {
              console.log(`⚠️ No se encontró variante en Shopify para ${localVariant.size}/${localVariant.color}`);
            }
          }
        }

        // 7. Actualizar SKU del producto si es necesario
        if (needsProductUpdate) {
          const { error: updateProductError } = await supabase
            .from('products')
            .update({ sku: newProductSku })
            .eq('id', localProduct.id);
          
          if (updateProductError) {
            console.error(`❌ Error actualizando producto ${localProduct.name}:`, updateProductError);
          } else {
            correctedProducts++;
          }
        }

        correctedVariants += variantUpdates;
        
        if (variantUpdates > 0 || needsProductUpdate) {
          console.log(`✅ Producto actualizado: ${needsProductUpdate ? '1 producto' : '0 productos'}, ${variantUpdates} variantes`);
        } else {
          console.log(`✓ Producto sin cambios necesarios`);
        }
      }

      const message = correctedProducts === 0 && correctedVariants === 0 
        ? `✅ Revisión completada: No se encontraron SKUs artificiales que corregir. ${skippedProducts} productos no encontrados en Shopify.`
        : `✅ Corrección completada: ${correctedProducts} productos y ${correctedVariants} variantes actualizados. ${skippedProducts} productos no encontrados en Shopify.`;

      console.log(`\n🎉 ${message}`);

      toast({
        title: "Corrección de SKUs completada",
        description: message,
      });

      return {
        success: true,
        correctedProducts,
        correctedVariants,
        skippedProducts
      };

    } catch (error: any) {
      console.error('💥 Error corrigiendo SKUs:', error);
      toast({
        title: "Error en corrección de SKUs",
        description: error.message || "No se pudieron corregir los SKUs",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    correctArtificialSkus,
    loading
  };
};
