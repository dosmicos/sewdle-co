
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    const { deliveryId, duplicatedItems } = await req.json()

    console.log('=== CORRIGIENDO DUPLICACIONES ===')
    console.log('Delivery ID:', deliveryId)
    console.log('Items duplicados:', duplicatedItems.length)

    // Obtener location ID
    const locationsUrl = `https://${shopifyDomain}/admin/api/2023-10/locations.json`
    const locationsResponse = await fetch(locationsUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    })

    if (!locationsResponse.ok) {
      throw new Error(`Error obteniendo locations: ${locationsResponse.status}`)
    }

    const locationsData = await locationsResponse.json()
    const primaryLocation = locationsData.locations.find(loc => loc.legacy || loc.primary) || locationsData.locations[0]
    const locationId = primaryLocation.id

    // Obtener productos de Shopify
    const allShopifyVariants = new Map()
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

      if (response.ok) {
        const data = await response.json()
        
        data.products.forEach(product => {
          product.variants.forEach(variant => {
            if (variant.sku) {
              allShopifyVariants.set(variant.sku, {
                id: variant.id,
                sku: variant.sku,
                inventory_item_id: variant.inventory_item_id,
                inventory_quantity: variant.inventory_quantity,
                product_title: product.title,
                product_id: product.id
              })
            }
          })
        })

        const linkHeader = response.headers.get('Link')
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
          pageInfo = match ? match[1] : null
        } else {
          hasNextPage = false
        }
      } else {
        hasNextPage = false
      }
    }

    const correctionResults = []
    let correctedItems = 0

    for (const item of duplicatedItems) {
      try {
        const variant = allShopifyVariants.get(item.sku)
        if (!variant) {
          console.log(`SKU ${item.sku} no encontrado en Shopify`)
          continue
        }

        // Obtener inventario actual
        const currentInventoryUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}&location_ids=${locationId}`
        const currentInventoryResponse = await fetch(currentInventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (!currentInventoryResponse.ok) {
          throw new Error(`Error consultando inventario para ${item.sku}`)
        }

        const currentInventoryData = await currentInventoryResponse.json()
        const inventoryLevel = currentInventoryData.inventory_levels?.[0]
        const currentInventory = inventoryLevel?.available || 0

        console.log(`SKU ${item.sku}: Inventario actual ${currentInventory}, Reducir ${item.duplicatedQuantity}`)

        // Reducir inventario para corregir duplicación
        const adjustUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/adjust.json`
        const adjustPayload = {
          location_id: locationId,
          inventory_item_id: variant.inventory_item_id,
          available_adjustment: -item.duplicatedQuantity // Negativo para reducir
        }

        const adjustResponse = await fetch(adjustUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(adjustPayload)
        })

        if (!adjustResponse.ok) {
          const errorText = await adjustResponse.text()
          console.error(`Error ajustando inventario para ${item.sku}:`, errorText)
          continue
        }

        // Verificar corrección
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const verificationResponse = await fetch(currentInventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (verificationResponse.ok) {
          const verificationData = await verificationResponse.json()
          const finalInventoryLevel = verificationData.inventory_levels?.[0]
          const finalInventory = finalInventoryLevel?.available || 0

          console.log(`SKU ${item.sku}: Inventario corregido ${currentInventory} -> ${finalInventory}`)

          correctionResults.push({
            sku: item.sku,
            status: 'corrected',
            previousInventory: currentInventory,
            correctedInventory: finalInventory,
            reductionApplied: item.duplicatedQuantity
          })

          correctedItems++
        }

      } catch (error) {
        console.error(`Error corrigiendo ${item.sku}:`, error)
        correctionResults.push({
          sku: item.sku,
          status: 'error',
          error: error.message
        })
      }
    }

    // Registrar corrección en logs
    const correctionLogData = {
      delivery_id: deliveryId,
      sync_results: correctionResults,
      success_count: correctedItems,
      error_count: duplicatedItems.length - correctedItems
    }

    await supabase.from('inventory_sync_logs').insert([{
      ...correctionLogData,
      synced_at: new Date().toISOString()
    }])

    return new Response(
      JSON.stringify({
        success: true,
        correctedItems,
        totalItems: duplicatedItems.length,
        details: correctionResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error corrigiendo duplicaciones:', error)
    
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
