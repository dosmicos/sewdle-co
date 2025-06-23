
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useSkuCorrection = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const correctArtificialSkus = async () => {
    setLoading(true);
    try {
      console.log('Iniciando corrección de SKUs artificiales...');

      // 1. Obtener todos los productos de Shopify
      const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('shopify-products', {
        body: { searchTerm: '' }
      });

      if (shopifyError || !shopifyData?.products) {
        throw new Error('Error obteniendo productos de Shopify');
      }

      // 2. Crear mapa de productos Shopify por título
      const shopifyProductsMap = new Map();
      shopifyData.products.forEach((product: any) => {
        shopifyProductsMap.set(product.title.toLowerCase(), product);
      });

      // 3. Obtener productos locales con SKUs artificiales
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
        `)
        .like('sku', '%-%-%'); // SKUs artificiales contienen guiones y timestamps

      if (localError) {
        throw new Error(`Error obteniendo productos locales: ${localError.message}`);
      }

      let correctedProducts = 0;
      let correctedVariants = 0;

      // 4. Procesar cada producto local
      for (const localProduct of localProducts || []) {
        const shopifyProduct = shopifyProductsMap.get(localProduct.name.toLowerCase());
        
        if (shopifyProduct && shopifyProduct.variants?.length > 0) {
          console.log(`Corrigiendo producto: ${localProduct.name}`);
          
          // Corregir SKU del producto principal
          const mainVariant = shopifyProduct.variants[0];
          const originalProductSku = mainVariant.sku || `SHOPIFY-${shopifyProduct.id}`;
          
          if (originalProductSku !== localProduct.sku) {
            const { error: updateProductError } = await supabase
              .from('products')
              .update({ sku: originalProductSku })
              .eq('id', localProduct.id);
            
            if (updateProductError) {
              console.error(`Error actualizando producto ${localProduct.name}:`, updateProductError);
            } else {
              correctedProducts++;
              console.log(`SKU producto corregido: ${localProduct.sku} → ${originalProductSku}`);
            }
          }

          // Corregir SKUs de variantes
          if (localProduct.product_variants?.length > 0) {
            for (let i = 0; i < localProduct.product_variants.length; i++) {
              const localVariant = localProduct.product_variants[i];
              const shopifyVariant = shopifyProduct.variants[i];
              
              if (shopifyVariant?.sku && shopifyVariant.sku !== localVariant.sku_variant) {
                const { error: updateVariantError } = await supabase
                  .from('product_variants')
                  .update({ sku_variant: shopifyVariant.sku })
                  .eq('id', localVariant.id);
                
                if (updateVariantError) {
                  console.error(`Error actualizando variante ${localVariant.id}:`, updateVariantError);
                } else {
                  correctedVariants++;
                  console.log(`SKU variante corregido: ${localVariant.sku_variant} → ${shopifyVariant.sku}`);
                }
              }
            }
          }
        }
      }

      toast({
        title: "SKUs corregidos exitosamente",
        description: `${correctedProducts} productos y ${correctedVariants} variantes actualizados con SKUs originales de Shopify.`,
      });

      return {
        success: true,
        correctedProducts,
        correctedVariants
      };

    } catch (error: any) {
      console.error('Error corrigiendo SKUs:', error);
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
