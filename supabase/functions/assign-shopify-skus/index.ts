
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

    console.log('Iniciando asignación de SKUs en Shopify usando IDs de variante')

    // Obtener todos los productos de Shopify
    const shopifyProducts = []
    let hasNextPage = true
    let pageInfo = null

    while (hasNextPage) {
      const url = new URL(`https://${shopifyDomain}/admin/api/2023-10/products.json`)
      url.searchParams.set('limit', '250')
      if (pageInfo) url.searchParams.set('page_info', pageInfo)

      const response = await fetch(url.toString(), {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error obteniendo productos de Shopify: ${response.status}`)
      }

      const data = await response.json()
      shopifyProducts.push(...data.products)

      // Verificar si hay más páginas
      const linkHeader = response.headers.get('Link')
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
        pageInfo = match ? match[1] : null
      } else {
        hasNextPage = false
      }
    }

    console.log(`Productos de Shopify encontrados: ${shopifyProducts.length}`)

    let totalVariants = 0
    let updatedVariants = 0
    let errorVariants = 0
    const updateResults = []

    // Procesar cada producto y sus variantes
    for (const product of shopifyProducts) {
      console.log(`Procesando producto: ${product.title} (ID: ${product.id})`)
      
      for (const variant of product.variants) {
        totalVariants++
        
        // Si la variante ya tiene SKU, skip
        if (variant.sku && variant.sku.trim() !== '') {
          console.log(`Variante ${variant.id} ya tiene SKU: ${variant.sku}`)
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
              variantId: variant.id,
              variantTitle: variant.title,
              status: 'error',
              error: `${updateResponse.status} - ${errorText}`,
              skuAssigned: null
            })
          } else {
            const updateData = await updateResponse.json()
            updatedVariants++
            console.log(`✅ SKU asignado exitosamente: ${newSku} a ${product.title} - ${variant.title}`)
            
            updateResults.push({
              productId: product.id,
              productTitle: product.title,
              variantId: variant.id,
              variantTitle: variant.title,
              status: 'success',
              error: null,
              skuAssigned: newSku
            })
          }

          // Pequeña pausa para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 200))

        } catch (error) {
          console.error(`Error procesando variante ${variant.id}:`, error.message)
          errorVariants++
          updateResults.push({
            productId: product.id,
            productTitle: product.title,
            variantId: variant.id,
            variantTitle: variant.title,
            status: 'error',
            error: error.message,
            skuAssigned: null
          })
        }
      }
    }

    const result = {
      success: true,
      summary: {
        totalProducts: shopifyProducts.length,
        totalVariants,
        updatedVariants,
        errorVariants,
        skippedVariants: totalVariants - updatedVariants - errorVariants
      },
      details: updateResults,
      message: `SKUs asignados exitosamente: ${updatedVariants} de ${totalVariants} variantes procesadas`
    }

    console.log('Asignación de SKUs completada:', result.summary)

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
