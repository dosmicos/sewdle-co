
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obtener credenciales de Shopify
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    console.log('Iniciando asignación optimizada de SKUs en Shopify')

    // Función para procesar en background
    const processSkuAssignment = async () => {
      try {
        // Obtener productos de Shopify filtrados por estado
        const shopifyProducts = []
        let hasNextPage = true
        let pageInfo = null

        while (hasNextPage) {
          const url = new URL(`https://${shopifyDomain}/admin/api/2023-10/products.json`)
          url.searchParams.set('limit', '50') // Reducido para mejor performance
          url.searchParams.set('status', 'active,draft') // Solo productos activos o en borrador
          if (pageInfo) url.searchParams.set('page_info', pageInfo)

          const response = await fetch(url.toString(), {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            console.error(`Error obteniendo productos de Shopify: ${response.status}`)
            break
          }

          const data = await response.json()
          
          // Filtrar productos por estado en el lado del cliente también
          const filteredProducts = data.products.filter((product: any) => 
            product.status === 'active' || product.status === 'draft'
          )
          
          shopifyProducts.push(...filteredProducts)

          // Verificar si hay más páginas
          const linkHeader = response.headers.get('Link')
          if (linkHeader && linkHeader.includes('rel="next"')) {
            const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
            pageInfo = match ? match[1] : null
          } else {
            hasNextPage = false
          }

          // Pausa entre requests para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 300))
        }

        console.log(`Productos activos/borrador encontrados: ${shopifyProducts.length}`)

        let totalVariants = 0
        let updatedVariants = 0
        let skippedVariants = 0
        let errorVariants = 0
        const updateResults = []

        // Procesar en lotes de 25 productos
        const batchSize = 25
        for (let i = 0; i < shopifyProducts.length; i += batchSize) {
          const batch = shopifyProducts.slice(i, i + batchSize)
          console.log(`Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(shopifyProducts.length / batchSize)}`)

          for (const product of batch) {
            console.log(`Procesando producto: ${product.title} (ID: ${product.id}, Estado: ${product.status})`)
            
            for (const variant of product.variants) {
              totalVariants++
              
              // Si la variante ya tiene SKU, skip
              if (variant.sku && variant.sku.trim() !== '') {
                console.log(`Variante ${variant.id} ya tiene SKU: ${variant.sku}`)
                skippedVariants++
                continue
              }

              try {
                // Usar el ID de la variante como SKU
                const newSku = variant.id.toString()
                
                console.log(`Asignando SKU ${newSku} a variante ${variant.id} del producto ${product.title}`)

                // Actualizar la variante en Shopify
                const updateUrl = `https://${shopifyDomain}/admin/api/2023-10/variants/${variant.id}.json`
                const updateResponse = await fetch(updateUrl, {
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
                  errorVariants++
                  updateResults.push({
                    productId: product.id,
                    productTitle: product.title,
                    productStatus: product.status,
                    variantId: variant.id,
                    variantTitle: variant.title,
                    status: 'error',
                    error: `${updateResponse.status} - ${errorText}`,
                    skuAssigned: null
                  })
                } else {
                  updatedVariants++
                  console.log(`✅ SKU asignado exitosamente: ${newSku} a ${product.title} - ${variant.title}`)
                  
                  updateResults.push({
                    productId: product.id,
                    productTitle: product.title,
                    productStatus: product.status,
                    variantId: variant.id,
                    variantTitle: variant.title,
                    status: 'success',
                    error: null,
                    skuAssigned: newSku
                  })
                }

                // Pausa más larga para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 400))

              } catch (error) {
                console.error(`Error procesando variante ${variant.id}:`, error.message)
                errorVariants++
                updateResults.push({
                  productId: product.id,
                  productTitle: product.title,
                  productStatus: product.status,
                  variantId: variant.id,
                  variantTitle: variant.title,
                  status: 'error',
                  error: error.message,
                  skuAssigned: null
                })
              }
            }
          }

          // Pausa entre lotes
          if (i + batchSize < shopifyProducts.length) {
            console.log('Pausando entre lotes...')
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }

        const finalResult = {
          success: true,
          summary: {
            totalProducts: shopifyProducts.length,
            totalVariants,
            updatedVariants,
            skippedVariants,
            errorVariants
          },
          details: updateResults.slice(0, 50), // Limitar detalles para evitar respuestas muy grandes
          message: `Proceso completado: ${updatedVariants} SKUs asignados, ${skippedVariants} ya tenían SKU, ${errorVariants} errores`
        }

        console.log('Asignación de SKUs completada:', finalResult.summary)
        
        // Aquí podrías guardar el resultado en Supabase si necesitas persistencia
        // await supabase.from('sku_assignment_logs').insert({
        //   result: finalResult,
        //   created_at: new Date().toISOString()
        // })

      } catch (error) {
        console.error('Error en procesamiento background:', error)
      }
    }

    // Iniciar procesamiento en background
    EdgeRuntime.waitUntil(processSkuAssignment())

    // Respuesta inmediata al cliente
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Procesamiento de SKUs iniciado en segundo plano. El proceso puede tardar varios minutos.',
        status: 'processing',
        note: 'Solo se procesarán productos activos y en borrador. Las variantes que ya tienen SKU serán omitidas.'
      }),
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
