
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
      
      shopifyData.products.forEach((product: unknown) => {
        // Mapear por título normalizado
        const normalizedTitle = product.title.toLowerCase().trim();
        shopifyProductsMap.set(normalizedTitle, product);
        
        // Mapear variantes por características múltiples
        product.variants?.forEach((variant: unknown) => {
          // Crear múltiples claves para mapear variantes
          const variantTitle = variant.title || '';
          const option1 = variant.option1 || '';
          const option2 = variant.option2 || '';
          const option3 = variant.option3 || '';
          
          // Crear claves de mapeo más específicas
          const keys = [
            `${normalizedTitle}|${variantTitle.toLowerCase()}`,
            `${normalizedTitle}|${option1.toLowerCase()}|${option2.toLowerCase()}`,
            `${normalizedTitle}|${option1.toLowerCase()}`,
            `${normalizedTitle}|${option2.toLowerCase()}`,
          ];
          
          keys.forEach(key => {
            if (key && !key.endsWith('|')) {
              shopifyVariantsMap.set(key, variant);
            }
          });
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

      // 4. Función mejorada para detectar SKUs artificiales
      const isArtificialSku = (sku: string): boolean => {
        if (!sku) return false;
        
        // Patrón 1: SKUs que empiezan con SHOPIFY-
        if (sku.startsWith('SHOPIFY-')) return true;
        
        // Patrón 2: SKUs con timestamps (números largos de 13 dígitos como timestamps)
        if (/\d{13}/.test(sku)) return true;
        
        // Patrón 3: SKUs con patrón NOMBRE-LETRA-NUMEROS-...-VX-COLOR
        if (/^[A-Z]+-[A-Z]-\d+-.+-V\d+-/.test(sku)) return true;
        
        // Patrón 4: SKUs con múltiples guiones y patrones específicos
        const dashCount = (sku.match(/-/g) || []).length;
        if (dashCount >= 4 && (/V\d+/.test(sku) || /\d{10,}/.test(sku))) return true;
        
        return false;
      };

      // 5. Función para encontrar la mejor coincidencia de variante
      const findBestVariantMatch = (productName: string, localVariant: unknown, shopifyProduct: unknown) => {
        if (!shopifyProduct.variants || shopifyProduct.variants.length === 0) {
          return null;
        }

        const normalizedProductName = productName.toLowerCase().trim();
        const localSize = (localVariant.size || '').toLowerCase().trim();
        const localColor = (localVariant.color || '').toLowerCase().trim();

        console.log(`🔍 Buscando variante para ${productName} - Talla: "${localSize}", Color: "${localColor}"`);

        // Intentar diferentes estrategias de mapeo
        const mappingStrategies = [
          // Estrategia 1: Match exacto por talla y color
          `${normalizedProductName}|${localSize}|${localColor}`,
          // Estrategia 2: Match por título completo de la variante
          `${normalizedProductName}|${localSize} / ${localColor}`,
          `${normalizedProductName}|${localColor} / ${localSize}`,
          // Estrategia 3: Match solo por talla
          `${normalizedProductName}|${localSize}`,
          // Estrategia 4: Match solo por color
          `${normalizedProductName}|${localColor}`,
        ];

        for (const strategy of mappingStrategies) {
          const variant = shopifyVariantsMap.get(strategy);
          if (variant) {
            console.log(`✅ Encontrada variante con estrategia: "${strategy}"`);
            return variant;
          }
        }

        // Estrategia 5: Búsqueda manual en las variantes
        for (const variant of shopifyProduct.variants) {
          const variantTitle = (variant.title || '').toLowerCase();
          const option1 = (variant.option1 || '').toLowerCase();
          const option2 = (variant.option2 || '').toLowerCase();
          
          // Match por características individuales
          const sizeMatch = !localSize || 
            variantTitle.includes(localSize) || 
            option1.includes(localSize) || 
            option2.includes(localSize);
            
          const colorMatch = !localColor || 
            variantTitle.includes(localColor) || 
            option1.includes(localColor) || 
            option2.includes(localColor);

          if (sizeMatch && colorMatch) {
            console.log(`✅ Encontrada variante por búsqueda manual: ${variant.title}`);
            return variant;
          }
        }

        console.log(`❌ No se encontró variante para ${localSize}/${localColor}`);
        return null;
      };

      // 6. Procesar cada producto local
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
        console.log(`📊 Producto tiene ${shopifyProduct.variants?.length || 0} variantes en Shopify`);

        // 7. Corregir SKU del producto principal si es necesario
        let needsProductUpdate = false;
        let newProductSku = localProduct.sku;

        if (isArtificialSku(localProduct.sku)) {
          // Usar el SKU del producto principal de Shopify (no de la variante)
          newProductSku = shopifyProduct.handle || shopifyProduct.id?.toString() || localProduct.sku;
          
          if (newProductSku !== localProduct.sku) {
            needsProductUpdate = true;
            console.log(`📝 SKU producto: "${localProduct.sku}" → "${newProductSku}"`);
          }
        } else {
          console.log(`✓ Producto ya tiene SKU válido: ${localProduct.sku}`);
        }

        // 8. Corregir SKUs de variantes usando mapeo inteligente
        let variantUpdates = 0;
        if (localProduct.product_variants?.length > 0) {
          console.log(`\n🔧 Procesando ${localProduct.product_variants.length} variantes locales...`);
          
          for (const localVariant of localProduct.product_variants) {
            console.log(`\n📋 Variante local: ${localVariant.size}/${localVariant.color} - SKU: ${localVariant.sku_variant}`);
            
            // Verificar si el SKU de la variante es artificial
            if (!isArtificialSku(localVariant.sku_variant)) {
              console.log(`✓ Variante ya tiene SKU válido: ${localVariant.sku_variant}`);
              continue;
            }

            // Buscar la mejor coincidencia de variante
            const shopifyVariant = findBestVariantMatch(localProduct.name, localVariant, shopifyProduct);

            if (shopifyVariant) {
              const correctSku = shopifyVariant.sku || shopifyVariant.id.toString();
              
              if (correctSku !== localVariant.sku_variant) {
                const { error: updateVariantError } = await supabase
                  .from('product_variants')
                  .update({ sku_variant: correctSku })
                  .eq('id', localVariant.id);
                
                if (updateVariantError) {
                  console.error(`❌ Error actualizando variante ${localVariant.id}:`, updateVariantError);
                } else {
                  variantUpdates++;
                  console.log(`📝 SKU variante actualizado: "${localVariant.sku_variant}" → "${correctSku}"`);
                  console.log(`📊 Shopify variante: ${shopifyVariant.title} (ID: ${shopifyVariant.id})`);
                }
              }
            } else {
              console.log(`⚠️ No se pudo mapear variante ${localVariant.size}/${localVariant.color}`);
              // Listar variantes disponibles para debugging
              console.log(`📋 Variantes disponibles en Shopify:`);
              shopifyProduct.variants?.forEach((v: unknown, idx: number) => {
                console.log(`   ${idx + 1}. ${v.title} (${v.option1}/${v.option2}) - SKU: ${v.sku}`);
              });
            }
          }
        }

        // 9. Actualizar SKU del producto si es necesario
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
          console.log(`✅ Producto "${localProduct.name}" actualizado: ${needsProductUpdate ? '1 producto' : '0 productos'}, ${variantUpdates} variantes`);
        } else {
          console.log(`✓ Producto "${localProduct.name}" sin cambios necesarios`);
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

    } catch (error: unknown) {
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
