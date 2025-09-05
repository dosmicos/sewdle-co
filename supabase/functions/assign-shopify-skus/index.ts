
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessParams {
  resumeFromCursor?: string;
  maxVariants?: number;
  processId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    // Normalize Shopify domain (handle cases where .myshopify.com is already included)
    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com') 
      ? rawShopifyDomain.replace('.myshopify.com', '')
      : rawShopifyDomain

    console.log(`🔗 Using Shopify domain: ${shopifyDomain}.myshopify.com`)

    const body = await req.json().catch(() => ({}))
    const { resumeFromCursor, maxVariants = 100, processId }: ProcessParams = body

    console.log('Iniciando proceso optimizado de asignación de SKUs', { resumeFromCursor, maxVariants, processId })

    // Buscar proceso existente o crear uno nuevo
    let currentLog
    if (processId) {
      const { data: existingLog } = await supabase
        .from('sku_assignment_logs')
        .select('*')
        .eq('process_id', processId)
        .single()
      currentLog = existingLog
    }

    if (!currentLog) {
      // Crear nuevo log de proceso
      const { data: newLog, error: logError } = await supabase
        .from('sku_assignment_logs')
        .insert({
          status: 'running',
          current_cursor: resumeFromCursor || null
        })
        .select()
        .single()

      if (logError) throw logError
      currentLog = newLog
    }

    const logId = currentLog.id
    const currentProcessId = currentLog.process_id

    // Función para actualizar el progreso
    const updateProgress = async (updates: any) => {
      await supabase
        .from('sku_assignment_logs')
        .update({
          ...updates,
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', logId)
    }

    // Función con backoff exponencial para rate limiting
    const makeShopifyRequest = async (url: string, options: any, retries = 3): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Shopify API call: ${url}`)
        
        const response = await fetch(url, options)
        
        if (response.status === 429) {
          await updateProgress({ 
            rate_limit_hits: (currentLog.rate_limit_hits || 0) + 1,
            shopify_api_calls: (currentLog.shopify_api_calls || 0) + 1
          })
          
          const retryAfter = response.headers.get('Retry-After')
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          
          console.log(`Rate limit hit, esperando ${delayMs}ms antes del reintento ${attempt}/${retries}`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }

        await updateProgress({ 
          shopify_api_calls: (currentLog.shopify_api_calls || 0) + 1
        })

        if (response.ok) {
          return response
        } else if (attempt === retries) {
          const errorText = await response.text()
          console.error(`Shopify API error después de ${retries} intentos:`, response.status, errorText)
          throw new Error(`Shopify API error: ${response.status} - ${errorText}`)
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
      
      throw new Error('Max retries reached')
    }

    // NUEVA FUNCIÓN: Verificar si un producto necesita procesamiento
    const productNeedsProcessing = (product: any) => {
      return product.variants.some((variant: any) => !variant.sku || variant.sku.trim() === '')
    }

    // NUEVA FUNCIÓN: Contar productos que realmente necesitan procesamiento
    const countProductsNeedingProcessing = async () => {
      console.log('Contando productos que necesitan procesamiento...')
      let productsNeedingProcessing = 0
      let variantsNeedingProcessing = 0
      let hasNextPage = true
      let tempCursor = null
      let totalProductsChecked = 0

      while (hasNextPage) {
        const url = new URL(`https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json`)
        url.searchParams.set('limit', '50')
        if (!tempCursor) {
          url.searchParams.set('status', 'active,draft')
        }
        if (tempCursor) {
          url.searchParams.set('page_info', tempCursor)
        }

        const response = await makeShopifyRequest(url.toString(), {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          }
        })

        const data = await response.json()
        
        const filteredProducts = tempCursor 
          ? data.products.filter((p: any) => p.status === 'active' || p.status === 'draft')
          : data.products
        
        totalProductsChecked += filteredProducts.length

        for (const product of filteredProducts) {
          if (productNeedsProcessing(product)) {
            productsNeedingProcessing++
            variantsNeedingProcessing += product.variants.filter((v: any) => !v.sku || v.sku.trim() === '').length
          }
        }

        const linkHeader = response.headers.get('Link')
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
          tempCursor = match ? match[1] : null
        } else {
          hasNextPage = false
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log(`Productos revisados: ${totalProductsChecked}, necesitan procesamiento: ${productsNeedingProcessing}, variantes sin SKU: ${variantsNeedingProcessing}`)
      return { productsNeedingProcessing, variantsNeedingProcessing, totalProductsChecked }
    }

    // FUNCIÓN MEJORADA: Cargar productos que necesitan procesamiento
    const loadProductsNeedingProcessing = async (cursor: string | null, maxProducts = 25) => {
      console.log(`Buscando productos que necesiten procesamiento desde cursor: ${cursor || 'inicio'}`)
      const productsNeedingWork = []
      let hasNextPage = true
      let tempCursor = cursor
      let productsScanned = 0
      let productsSkipped = 0

      while (hasNextPage && productsNeedingWork.length < maxProducts) {
        const url = new URL(`https://${shopifyDomain}.myshopify.com/admin/api/2023-10/products.json`)
        url.searchParams.set('limit', '25')
        if (!tempCursor) {
          url.searchParams.set('status', 'active,draft')
        }
        if (tempCursor) {
          url.searchParams.set('page_info', tempCursor)
        }

        console.log(`Consultando: ${url.toString()}`)

        const response = await makeShopifyRequest(url.toString(), {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          }
        })

        const data = await response.json()
        
        const filteredProducts = tempCursor 
          ? data.products.filter((p: any) => p.status === 'active' || p.status === 'draft')
          : data.products
        
        productsScanned += filteredProducts.length

        // FILTRAR: Solo agregar productos que realmente necesiten procesamiento
        for (const product of filteredProducts) {
          if (productNeedsProcessing(product)) {
            productsNeedingWork.push(product)
            console.log(`✓ Producto necesita procesamiento: ${product.title} (${product.variants.filter((v: any) => !v.sku || v.sku.trim() === '').length} variantes sin SKU)`)
          } else {
            productsSkipped++
            console.log(`○ Producto ya procesado: ${product.title} (todas las variantes tienen SKU)`)
          }
        }

        const linkHeader = response.headers.get('Link')
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
          tempCursor = match ? match[1] : null
        } else {
          hasNextPage = false
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log(`Escaneo completado: ${productsScanned} productos revisados, ${productsSkipped} ya procesados, ${productsNeedingWork.length} necesitan trabajo`)
      return { products: productsNeedingWork, nextCursor: tempCursor, productsScanned, productsSkipped }
    }

    // Procesar productos en chunks
    const processSkuAssignment = async () => {
      try {
        let cursor = resumeFromCursor || currentLog.current_cursor
        let processedCount = currentLog.processed_variants || 0
        let updatedCount = currentLog.updated_variants || 0
        let skippedCount = currentLog.skipped_variants || 0
        let errorCount = currentLog.error_variants || 0

        // PASO 1: Si es un proceso nuevo, contar productos que realmente necesitan procesamiento
        if (!cursor) {
          console.log('=== INICIANDO ANÁLISIS PREVIO ===')
          const analysis = await countProductsNeedingProcessing()
          
          if (analysis.variantsNeedingProcessing === 0) {
            await updateProgress({ 
              status: 'completed',
              completed_at: new Date().toISOString(),
              total_products: analysis.totalProductsChecked,
              total_variants: analysis.variantsNeedingProcessing
            })

            return {
              success: true,
              status: 'completed',
              processId: currentProcessId,
              summary: {
                totalProducts: analysis.totalProductsChecked,
                totalVariants: analysis.variantsNeedingProcessing,
                processedVariants: 0,
                updatedVariants: 0,
                skippedVariants: 0,
                errorVariants: 0
              },
              message: `✅ Análisis completado: No hay variantes sin SKU. Todos los ${analysis.totalProductsChecked} productos ya están procesados.`
            }
          }

          await updateProgress({ 
            total_products: analysis.productsNeedingProcessing,
            total_variants: analysis.variantsNeedingProcessing
          })

          console.log(`=== PRODUCTOS PENDIENTES: ${analysis.productsNeedingProcessing} productos, ${analysis.variantsNeedingProcessing} variantes ===`)
        }

        // PASO 2: Cargar productos que necesitan trabajo
        console.log('=== CARGANDO PRODUCTOS PARA PROCESAR ===')
        const { products, nextCursor, productsScanned, productsSkipped } = await loadProductsNeedingProcessing(cursor, Math.ceil(maxVariants / 10))
        
        if (products.length === 0) {
          console.log('✅ No se encontraron más productos que necesiten procesamiento')
          await updateProgress({
            status: 'completed',
            completed_at: new Date().toISOString()
          })

          return {
            success: true,
            status: 'completed',
            processId: currentProcessId,
            summary: {
              totalProducts: currentLog.total_products || 0,
              totalVariants: currentLog.total_variants || 0,
              processedVariants: processedCount,
              updatedVariants: updatedCount,
              skippedVariants: skippedCount,
              errorVariants: errorCount
            },
            message: `✅ Proceso completado: No quedan productos por procesar. Se revisaron ${productsScanned} productos adicionales.`
          }
        }

        cursor = nextCursor
        console.log(`=== PROCESANDO ${products.length} PRODUCTOS (${productsSkipped} ya procesados fueron saltados) ===`)

        let variantsProcessedInBatch = 0
        const updateResults = []

        for (const product of products) {
          if (variantsProcessedInBatch >= maxVariants) {
            console.log(`Límite de ${maxVariants} variantes alcanzado en este lote`)
            break
          }

          console.log(`🔄 Procesando producto: ${product.title} (ID: ${product.id})`)
          
          await updateProgress({ 
            current_cursor: cursor,
            last_processed_product_id: product.id.toString()
          })

          // Solo procesar variantes que realmente necesiten SKU
          const variantsNeedingSku = product.variants.filter((v: any) => !v.sku || v.sku.trim() === '')
          console.log(`  → ${variantsNeedingSku.length} variantes necesitan SKU de ${product.variants.length} totales`)

          for (const variant of variantsNeedingSku) {
            if (variantsProcessedInBatch >= maxVariants) break

            processedCount++
            variantsProcessedInBatch++

            await updateProgress({ 
              processed_variants: processedCount,
              last_processed_variant_id: variant.id.toString()
            })

            try {
              // 🔍 NUEVA LÓGICA: Verificar si ya existe una variante local con las mismas características
              const { data: existingVariant, error: findError } = await supabase.rpc('find_matching_local_variant', {
                p_product_name: product.title,
                p_size: variant.option1 || null,
                p_color: variant.option2 || null, 
                p_organization_id: organizationId
              });

              if (findError) {
                console.error(`❌ Error buscando variante existente:`, findError);
              }

              if (existingVariant) {
                console.log(`  ⚠️ Ya existe variante local para ${product.title} ${variant.option1 || ''} ${variant.option2 || ''} - actualizando SKU existente`)
                
                // Actualizar la variante local existente con el SKU de Shopify
                const { error: updateLocalError } = await supabase
                  .from('product_variants')
                  .update({ sku_variant: variant.id.toString() })
                  .eq('id', existingVariant);

                if (updateLocalError) {
                  console.error(`❌ Error actualizando variante local:`, updateLocalError);
                } else {
                  console.log(`  ✅ Variante local actualizada con SKU ${variant.id.toString()}`);
                }
              }

              const newSku = variant.id.toString()
              console.log(`  → Asignando SKU ${newSku} a variante Shopify ${variant.id}`)

              const updateUrl = `https://${shopifyDomain}.myshopify.com/admin/api/2023-10/variants/${variant.id}.json`
              const updateResponse = await makeShopifyRequest(updateUrl, {
                method: 'PUT',
                headers: {
                  'X-Shopify-Access-Token': shopifyToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  variant: {
                    id: variant.id,
                    sku: newSku
                  }
                })
              })

              if (!updateResponse.ok) {
                const errorText = await updateResponse.text()
                console.error(`❌ Error actualizando variante ${variant.id}:`, errorText)
                errorCount++
                updateResults.push({
                  productId: product.id,
                  productTitle: product.title,
                  variantId: variant.id,
                  status: 'error',
                  error: `${updateResponse.status} - ${errorText}`
                })
              } else {
                updatedCount++
                console.log(`  ✅ SKU asignado exitosamente: ${newSku}`)
                updateResults.push({
                  productId: product.id,
                  productTitle: product.title,
                  variantId: variant.id,
                  status: 'success',
                  skuAssigned: newSku
                })
              }

              await updateProgress({
                updated_variants: updatedCount,
                error_variants: errorCount
              })

              await new Promise(resolve => setTimeout(resolve, 800))

            } catch (error) {
              console.error(`❌ Error procesando variante ${variant.id}:`, error.message)
              errorCount++
              updateResults.push({
                productId: product.id,
                productTitle: product.title,
                variantId: variant.id,
                status: 'error',
                error: error.message
              })
              await updateProgress({ error_variants: errorCount })
            }
          }

          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Determinar si el proceso está completo
        const isComplete = products.length < Math.ceil(maxVariants / 10) || variantsProcessedInBatch < maxVariants
        const finalStatus = isComplete ? 'completed' : 'paused'

        const finalResult = {
          success: true,
          status: finalStatus,
          processId: currentProcessId,
          summary: {
            totalProducts: currentLog.total_products || products.length,
            totalVariants: currentLog.total_variants || variantsProcessedInBatch,
            processedVariants: processedCount,
            updatedVariants: updatedCount,
            skippedVariants: skippedCount,
            errorVariants: errorCount,
            productsScanned,
            productsSkipped
          },
          details: updateResults.slice(-10),
          nextCursor: isComplete ? null : cursor,
          message: isComplete 
            ? `✅ Proceso completado: ${updatedCount} SKUs asignados, ${errorCount} errores. Se revisaron ${productsScanned} productos.`
            : `📊 Lote procesado: ${updatedCount} SKUs asignados en este lote. Continuar para procesar más productos.`
        }

        await updateProgress({
          status: finalStatus,
          detailed_results: updateResults,
          completed_at: isComplete ? new Date().toISOString() : null
        })

        console.log('=== PROCESO FINALIZADO ===', finalResult.summary)
        return finalResult

      } catch (error) {
        console.error('❌ Error en procesamiento:', error)
        await updateProgress({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        throw error
      }
    }

    const result = await processSkuAssignment()

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en asignación de SKUs:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
