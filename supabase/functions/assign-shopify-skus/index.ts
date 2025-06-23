
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

    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    const body = await req.json().catch(() => ({}))
    const { resumeFromCursor, maxVariants = 100, processId }: ProcessParams = body

    console.log('Iniciando asignación de SKUs con persistencia', { resumeFromCursor, maxVariants, processId })

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
        const response = await fetch(url, options)
        
        if (response.status === 429) {
          // Rate limit hit
          await updateProgress({ 
            rate_limit_hits: currentLog.rate_limit_hits + 1,
            shopify_api_calls: currentLog.shopify_api_calls + 1
          })
          
          const retryAfter = response.headers.get('Retry-After')
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          
          console.log(`Rate limit hit, esperando ${delayMs}ms antes del reintento ${attempt}/${retries}`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }

        await updateProgress({ 
          shopify_api_calls: currentLog.shopify_api_calls + 1
        })

        if (response.ok) {
          return response
        } else if (attempt === retries) {
          throw new Error(`Shopify API error: ${response.status} - ${await response.text()}`)
        }
        
        // Pausa antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
      
      throw new Error('Max retries reached')
    }

    // Procesar productos en chunks
    const processSkuAssignment = async () => {
      try {
        let cursor = resumeFromCursor || currentLog.current_cursor
        let processedCount = currentLog.processed_variants || 0
        let updatedCount = currentLog.updated_variants || 0
        let skippedCount = currentLog.skipped_variants || 0
        let errorCount = currentLog.error_variants || 0
        let totalProducts = currentLog.total_products || 0
        let totalVariants = currentLog.total_variants || 0
        let allProducts = []

        // Si es la primera vez, contar productos totales
        if (!cursor && totalProducts === 0) {
          console.log('Primera ejecución: contando productos...')
          let hasNextPage = true
          let tempCursor = null

          while (hasNextPage) {
            const url = new URL(`https://${shopifyDomain}/admin/api/2023-10/products.json`)
            url.searchParams.set('limit', '50')
            url.searchParams.set('status', 'active,draft')
            if (tempCursor) url.searchParams.set('page_info', tempCursor)

            const response = await makeShopifyRequest(url.toString(), {
              headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json',
              }
            })

            const data = await response.json()
            const filteredProducts = data.products.filter((p: any) => 
              p.status === 'active' || p.status === 'draft'
            )
            
            allProducts.push(...filteredProducts)
            totalProducts += filteredProducts.length
            totalVariants += filteredProducts.reduce((sum: number, p: any) => sum + p.variants.length, 0)

            const linkHeader = response.headers.get('Link')
            if (linkHeader && linkHeader.includes('rel="next"')) {
              const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
              tempCursor = match ? match[1] : null
            } else {
              hasNextPage = false
            }

            await new Promise(resolve => setTimeout(resolve, 500))
          }

          await updateProgress({ total_products: totalProducts, total_variants: totalVariants })
          console.log(`Total encontrado: ${totalProducts} productos, ${totalVariants} variantes`)
        }

        // Si no tenemos productos cargados, cargarlos desde el cursor
        if (allProducts.length === 0) {
          let hasNextPage = true
          let tempCursor = cursor

          while (hasNextPage && allProducts.length < maxVariants) {
            const url = new URL(`https://${shopifyDomain}/admin/api/2023-10/products.json`)
            url.searchParams.set('limit', '25')
            url.searchParams.set('status', 'active,draft')
            if (tempCursor) url.searchParams.set('page_info', tempCursor)

            const response = await makeShopifyRequest(url.toString(), {
              headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json',
              }
            })

            const data = await response.json()
            const filteredProducts = data.products.filter((p: any) => 
              p.status === 'active' || p.status === 'draft'
            )
            
            allProducts.push(...filteredProducts)

            const linkHeader = response.headers.get('Link')
            if (linkHeader && linkHeader.includes('rel="next"')) {
              const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
              tempCursor = match ? match[1] : null
              cursor = tempCursor
            } else {
              hasNextPage = false
            }

            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }

        console.log(`Procesando ${allProducts.length} productos desde cursor`)

        let variantsProcessedInBatch = 0
        const updateResults = []

        for (const product of allProducts) {
          if (variantsProcessedInBatch >= maxVariants) {
            console.log(`Límite de ${maxVariants} variantes alcanzado en este lote`)
            break
          }

          console.log(`Procesando producto: ${product.title} (ID: ${product.id}, Estado: ${product.status})`)
          
          await updateProgress({ 
            current_cursor: cursor,
            last_processed_product_id: product.id.toString()
          })

          for (const variant of product.variants) {
            if (variantsProcessedInBatch >= maxVariants) break

            processedCount++
            variantsProcessedInBatch++

            await updateProgress({ 
              processed_variants: processedCount,
              last_processed_variant_id: variant.id.toString()
            })

            if (variant.sku && variant.sku.trim() !== '') {
              console.log(`Variante ${variant.id} ya tiene SKU: ${variant.sku}`)
              skippedCount++
              await updateProgress({ skipped_variants: skippedCount })
              continue
            }

            try {
              const newSku = variant.id.toString()
              console.log(`Asignando SKU ${newSku} a variante ${variant.id}`)

              const updateUrl = `https://${shopifyDomain}/admin/api/2023-10/variants/${variant.id}.json`
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
                console.error(`Error actualizando variante ${variant.id}:`, errorText)
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
                console.log(`✅ SKU asignado: ${newSku}`)
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

              // Pausa adaptativa basada en el rendimiento
              await new Promise(resolve => setTimeout(resolve, 800))

            } catch (error) {
              console.error(`Error procesando variante ${variant.id}:`, error.message)
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

          // Pausa entre productos
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // Determinar si el proceso está completo
        const isComplete = variantsProcessedInBatch < maxVariants || allProducts.length < 25
        const finalStatus = isComplete ? 'completed' : 'paused'

        const finalResult = {
          success: true,
          status: finalStatus,
          processId: currentProcessId,
          summary: {
            totalProducts,
            totalVariants,
            processedVariants: processedCount,
            updatedVariants: updatedCount,
            skippedVariants: skippedCount,
            errorVariants: errorCount
          },
          details: updateResults.slice(-20),
          nextCursor: isComplete ? null : cursor,
          message: isComplete 
            ? `Proceso completado: ${updatedCount} SKUs asignados, ${skippedCount} ya tenían SKU, ${errorCount} errores`
            : `Lote procesado: ${updatedCount} SKUs asignados. Continuar desde cursor para procesar más.`
        }

        // Actualizar estado final
        await updateProgress({
          status: finalStatus,
          detailed_results: updateResults,
          completed_at: isComplete ? new Date().toISOString() : null
        })

        console.log('Proceso finalizado:', finalResult.summary)
        return finalResult

      } catch (error) {
        console.error('Error en procesamiento:', error)
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
    console.error('Error en asignación de SKUs:', error)
    
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
