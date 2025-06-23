
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

    const { deliveryId, approvedItems } = await req.json()

    if (!deliveryId || !approvedItems || !Array.isArray(approvedItems)) {
      throw new Error('Datos de sincronización inválidos')
    }

    console.log('Starting Shopify sync for delivery:', deliveryId)
    console.log('Items to sync:', approvedItems.length)

    // Verificar si ya está sincronizada
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select('synced_to_shopify, sync_attempts')
      .eq('id', deliveryId)
      .single()

    if (deliveryError) {
      throw new Error(`Error verificando entrega: ${deliveryError.message}`)
    }

    if (delivery.synced_to_shopify) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Esta entrega ya fue sincronizada con Shopify',
          summary: { successful: 0, failed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Incrementar contador de intentos
    await supabase
      .from('deliveries')
      .update({ 
        sync_attempts: (delivery.sync_attempts || 0) + 1,
        last_sync_attempt: new Date().toISOString()
      })
      .eq('id', deliveryId)

    console.log('Delivery sync attempts:', (delivery.sync_attempts || 0) + 1)

    const syncResults = []
    let successCount = 0
    let errorCount = 0

    // Función mejorada para buscar variantes por SKU usando GraphQL
    async function findVariantBySku(sku: string) {
      console.log(`Buscando variante con SKU: ${sku}`)
      
      try {
        // Usar GraphQL para buscar por SKU más eficientemente
        const query = `
          query getProductVariants($query: String!) {
            productVariants(first: 10, query: $query) {
              edges {
                node {
                  id
                  sku
                  inventoryQuantity
                  product {
                    id
                    title
                  }
                }
              }
            }
          }
        `

        const graphqlUrl = `https://${shopifyDomain}/admin/api/2023-10/graphql.json`
        const response = await fetch(graphqlUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: {
              query: `sku:${sku}`
            }
          })
        })

        if (!response.ok) {
          console.error(`GraphQL request failed: ${response.status} ${response.statusText}`)
          // Fallback a REST API
          return await findVariantBySkuRest(sku)
        }

        const data = await response.json()
        console.log('GraphQL response:', JSON.stringify(data, null, 2))

        if (data.errors) {
          console.error('GraphQL errors:', data.errors)
          // Fallback a REST API
          return await findVariantBySkuRest(sku)
        }

        const variants = data.data?.productVariants?.edges || []
        const variant = variants.find(edge => edge.node.sku === sku)
        
        if (variant) {
          // Convertir ID de GraphQL a REST API format
          const gid = variant.node.id
          const restId = gid.split('/').pop()
          
          console.log(`Variante encontrada: ID ${restId}, SKU ${variant.node.sku}, Inventario: ${variant.node.inventoryQuantity}`)
          
          return {
            id: restId,
            sku: variant.node.sku,
            inventory_quantity: variant.node.inventoryQuantity,
            product_title: variant.node.product.title
          }
        }

        console.log(`No se encontró variante con SKU: ${sku} usando GraphQL`)
        return null

      } catch (error) {
        console.error(`Error en búsqueda GraphQL para SKU ${sku}:`, error)
        // Fallback a REST API
        return await findVariantBySkuRest(sku)
      }
    }

    // Función fallback usando REST API
    async function findVariantBySkuRest(sku: string) {
      console.log(`Fallback: Buscando con REST API - SKU: ${sku}`)
      
      try {
        // Buscar usando el endpoint de inventory_items
        const inventoryUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_items.json?limit=250`
        let pageInfo = null
        
        // Primero obtener todos los inventory items
        do {
          const url = new URL(inventoryUrl)
          if (pageInfo) {
            url.searchParams.set('page_info', pageInfo)
          }

          const response = await fetch(url.toString(), {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error(`Error buscando inventory items: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()
          const inventoryItems = data.inventory_items || []
          
          // Buscar el item con el SKU correcto
          const item = inventoryItems.find(item => item.sku === sku)
          if (item) {
            // Ahora buscar la variante que usa este inventory item
            const variantResponse = await fetch(
              `https://${shopifyDomain}/admin/api/2023-10/variants.json?limit=250&inventory_item_id=${item.id}`,
              {
                headers: {
                  'X-Shopify-Access-Token': shopifyToken,
                  'Content-Type': 'application/json',
                },
              }
            )

            if (variantResponse.ok) {
              const variantData = await variantResponse.json()
              const variant = variantData.variants?.[0]
              
              if (variant) {
                console.log(`Variante encontrada via REST: ID ${variant.id}, SKU ${variant.sku}, Inventario: ${variant.inventory_quantity}`)
                return variant
              }
            }
          }

          // Obtener página siguiente si existe
          const linkHeader = response.headers.get('Link')
          if (linkHeader && linkHeader.includes('rel="next"')) {
            const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
            pageInfo = match ? match[1] : null
          } else {
            pageInfo = null
          }
        } while (pageInfo)

        console.log(`No se encontró variante con SKU: ${sku} usando REST API`)
        return null

      } catch (error) {
        console.error(`Error en búsqueda REST para SKU ${sku}:`, error)
        return null
      }
    }

    // Procesar cada item aprobado
    for (const item of approvedItems) {
      try {
        console.log(`=== Sincronizando item ===`)
        console.log(`SKU: ${item.skuVariant}`)
        console.log(`Cantidad a agregar: ${item.quantityApproved}`)
        
        // Buscar la variante específica por SKU
        const targetVariant = await findVariantBySku(item.skuVariant)

        if (!targetVariant) {
          throw new Error(`Variante con SKU ${item.skuVariant} no encontrada en Shopify. Verifica que el producto existe y el SKU es correcto.`)
        }

        const currentInventory = targetVariant.inventory_quantity || 0
        const newInventoryQuantity = currentInventory + item.quantityApproved
        
        console.log(`Actualizando inventario:`)
        console.log(`- SKU: ${item.skuVariant}`)
        console.log(`- Inventario actual: ${currentInventory}`)
        console.log(`- Cantidad a agregar: ${item.quantityApproved}`)
        console.log(`- Nuevo inventario: ${newInventoryQuantity}`)

        // Actualizar inventario en Shopify
        const updateUrl = `https://${shopifyDomain}/admin/api/2023-10/variants/${targetVariant.id}.json`
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variant: {
              id: targetVariant.id,
              inventory_quantity: newInventoryQuantity
            }
          })
        })

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text()
          console.error(`Error actualizando variante ${targetVariant.id}:`, errorText)
          throw new Error(`Error actualizando inventario: ${updateResponse.status} - ${errorText}`)
        }

        const updateData = await updateResponse.json()
        console.log(`✅ Éxito: Inventario actualizado para ${item.skuVariant}:`)
        console.log(`   ${currentInventory} → ${updateData.variant.inventory_quantity}`)

        syncResults.push({
          sku: item.skuVariant,
          status: 'success',
          previousQuantity: currentInventory,
          addedQuantity: item.quantityApproved,
          newQuantity: updateData.variant.inventory_quantity,
          variantId: targetVariant.id,
          productTitle: targetVariant.product_title || 'Unknown'
        })

        successCount++

      } catch (error) {
        console.error(`❌ Error sincronizando ${item.skuVariant}:`, error.message)
        
        syncResults.push({
          sku: item.skuVariant,
          status: 'error',
          error: error.message,
          quantityAttempted: item.quantityApproved
        })

        errorCount++
      }
    }

    // Registrar resultado en la base de datos
    const logData = {
      delivery_id: deliveryId,
      sync_results: syncResults,
      success_count: successCount,
      error_count: errorCount
    }

    const { error: logError } = await supabase
      .from('inventory_sync_logs')
      .insert([logData])

    if (logError) {
      console.error('Error guardando log:', logError)
    }

    // Marcar entrega como sincronizada si fue exitosa
    if (successCount > 0 && errorCount === 0) {
      await supabase
        .from('deliveries')
        .update({ 
          synced_to_shopify: true,
          sync_error_message: null
        })
        .eq('id', deliveryId)
      
      console.log(`✅ Entrega ${deliveryId} marcada como sincronizada`)
    } else if (errorCount > 0) {
      // Registrar mensaje de error si hubo fallos
      const errorMessage = syncResults
        .filter(r => r.status === 'error')
        .map(r => `${r.sku}: ${r.error}`)
        .join('; ')
      
      await supabase
        .from('deliveries')
        .update({ sync_error_message: errorMessage })
        .eq('id', deliveryId)
    }

    const response = {
      success: successCount > 0,
      summary: {
        successful: successCount,
        failed: errorCount,
        total: approvedItems.length
      },
      details: syncResults,
      error: errorCount > 0 ? `${errorCount} items fallaron en la sincronización` : null
    }

    console.log('=== Sync completed ===')
    console.log('Summary:', response.summary)
    if (errorCount > 0) {
      console.log('Errors:', syncResults.filter(r => r.status === 'error').map(r => `${r.sku}: ${r.error}`))
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error en sincronización:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        summary: { successful: 0, failed: 0 }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
