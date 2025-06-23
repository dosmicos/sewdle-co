
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

    // PRIMERA VALIDACIÓN: Verificar que todos los SKUs existen en Shopify antes de proceder
    console.log('=== PRE-VALIDATION: Verificando existencia de SKUs ===')
    const skusToValidate = approvedItems.map(item => item.skuVariant)
    const validationResults = []

    // Obtener TODOS los productos de Shopify con sus variantes
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
                inventory_quantity: variant.inventory_quantity,
                product_title: product.title,
                product_id: product.id
              })
            }
          })
        })

        // Verificar si hay más páginas
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

    console.log(`Total variantes cargadas de Shopify: ${allShopifyVariants.size}`)

    // Validar cada SKU
    for (const sku of skusToValidate) {
      if (allShopifyVariants.has(sku)) {
        validationResults.push({
          sku,
          found: true,
          variant: allShopifyVariants.get(sku)
        })
        console.log(`✅ SKU encontrado: ${sku}`)
      } else {
        validationResults.push({
          sku,
          found: false,
          variant: null
        })
        console.log(`❌ SKU NO encontrado: ${sku}`)
      }
    }

    // Verificar si algún SKU no fue encontrado
    const missingSkus = validationResults.filter(result => !result.found)
    
    if (missingSkus.length > 0) {
      console.log('=== SKUS FALTANTES DETECTADOS ===')
      missingSkus.forEach(missing => {
        console.log(`Faltante: ${missing.sku}`)
      })

      // Registrar error específico
      const errorMessage = `SKUs no encontrados en Shopify: ${missingSkus.map(m => m.sku).join(', ')}`
      
      await supabase
        .from('deliveries')
        .update({ 
          sync_error_message: errorMessage
        })
        .eq('id', deliveryId)

      // Generar respuesta de error con detalles
      const syncResults = missingSkus.map(missing => ({
        sku: missing.sku,
        status: 'error',
        error: `SKU '${missing.sku}' no existe en Shopify. Verifica que el producto fue creado correctamente en Shopify con este SKU exacto.`,
        quantityAttempted: approvedItems.find(item => item.skuVariant === missing.sku)?.quantityApproved || 0
      }))

      // Log para diagnóstico
      const logData = {
        delivery_id: deliveryId,
        sync_results: syncResults,
        success_count: 0,
        error_count: missingSkus.length
      }

      await supabase
        .from('inventory_sync_logs')
        .insert([logData])

      return new Response(
        JSON.stringify({
          success: false,
          summary: {
            successful: 0,
            failed: missingSkus.length,
            total: approvedItems.length
          },
          details: syncResults,
          error: `${missingSkus.length} SKUs no encontrados en Shopify`,
          validation: {
            total_skus_checked: skusToValidate.length,
            missing_skus: missingSkus.length,
            missing_sku_list: missingSkus.map(m => m.sku)
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Todos los SKUs fueron encontrados en Shopify. Procediendo con la sincronización...')

    // SINCRONIZACIÓN: Actualizar inventarios
    const syncResults = []
    let successCount = 0
    let errorCount = 0

    for (const item of approvedItems) {
      try {
        console.log(`=== Sincronizando item ===`)
        console.log(`SKU: ${item.skuVariant}`)
        console.log(`Cantidad a agregar: ${item.quantityApproved}`)
        
        // Obtener datos de la variante (ya validada)
        const validatedVariant = validationResults.find(v => v.sku === item.skuVariant && v.found)
        
        if (!validatedVariant) {
          throw new Error(`Error interno: variante ${item.skuVariant} no encontrada en validación`)
        }

        const targetVariant = validatedVariant.variant
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
          productTitle: targetVariant.product_title
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
      error: errorCount > 0 ? `${errorCount} items fallaron en la sincronización` : null,
      validation: {
        total_variants_in_shopify: allShopifyVariants.size,
        all_skus_found: true
      }
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
