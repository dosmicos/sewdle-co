
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

    console.log('=== SHOPIFY SYNC INICIADO ===')
    console.log('Domain:', shopifyDomain)
    console.log('Token presente:', shopifyToken ? 'Sí' : 'No')

    const { deliveryId, approvedItems } = await req.json()

    if (!deliveryId || !approvedItems || !Array.isArray(approvedItems)) {
      throw new Error('Datos de sincronización inválidos')
    }

    console.log('=== DATOS DE ENTRADA ===')
    console.log('Delivery ID:', deliveryId)
    console.log('Items a sincronizar:', approvedItems.length)
    console.log('Items:', JSON.stringify(approvedItems, null, 2))

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

    console.log('=== PASO 1: VERIFICACIÓN DE AUTENTICACIÓN ===')
    
    // Verificar permisos del token con una llamada de prueba
    const testUrl = `https://${shopifyDomain}/admin/api/2023-10/shop.json`
    const testResponse = await fetch(testUrl, {
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
        'Content-Type': 'application/json',
      },
    })

    console.log('Test de autenticación status:', testResponse.status)
    console.log('Test headers:', Object.fromEntries(testResponse.headers.entries()))

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      throw new Error(`Fallo autenticación Shopify: ${testResponse.status} - ${errorText}`)
    }

    const shopData = await testResponse.json()
    console.log('✅ Autenticación exitosa - Shop:', shopData.shop?.name || 'N/A')

    console.log('=== PASO 2: VALIDACIÓN DE SKUS ===')
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

      console.log('Consultando productos:', url.toString())

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

    console.log(`Total variantes en Shopify: ${allShopifyVariants.size}`)

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
      console.log('=== SKUS FALTANTES ===')
      const errorMessage = `SKUs no encontrados en Shopify: ${missingSkus.map(m => m.sku).join(', ')}`
      
      await supabase
        .from('deliveries')
        .update({ sync_error_message: errorMessage })
        .eq('id', deliveryId)

      const syncResults = missingSkus.map(missing => ({
        sku: missing.sku,
        status: 'error',
        error: `SKU '${missing.sku}' no existe en Shopify`,
        quantityAttempted: approvedItems.find(item => item.skuVariant === missing.sku)?.quantityApproved || 0
      }))

      const logData = {
        delivery_id: deliveryId,
        sync_results: syncResults,
        success_count: 0,
        error_count: missingSkus.length
      }

      await supabase.from('inventory_sync_logs').insert([logData])

      return new Response(
        JSON.stringify({
          success: false,
          summary: { successful: 0, failed: missingSkus.length, total: approvedItems.length },
          details: syncResults,
          error: `${missingSkus.length} SKUs no encontrados en Shopify`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== PASO 3: SINCRONIZACIÓN CON VERIFICACIÓN POST-ACTUALIZACIÓN ===')
    const syncResults = []
    let successCount = 0
    let errorCount = 0

    for (const item of approvedItems) {
      try {
        console.log(`\n=== PROCESANDO ITEM: ${item.skuVariant} ===`)
        
        const validatedVariant = validationResults.find(v => v.sku === item.skuVariant && v.found)
        if (!validatedVariant) {
          throw new Error(`Error interno: variante ${item.skuVariant} no encontrada`)
        }

        const targetVariant = validatedVariant.variant
        console.log('Variant ID:', targetVariant.id)
        console.log('Inventario actual reportado:', targetVariant.inventory_quantity)
        console.log('Cantidad a agregar:', item.quantityApproved)

        // PASO 3A: Consultar inventario actual DIRECTAMENTE desde Shopify
        const currentInventoryUrl = `https://${shopifyDomain}/admin/api/2023-10/variants/${targetVariant.id}.json`
        const currentInventoryResponse = await fetch(currentInventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (!currentInventoryResponse.ok) {
          throw new Error(`Error consultando inventario actual: ${currentInventoryResponse.status}`)
        }

        const currentInventoryData = await currentInventoryResponse.json()
        const realCurrentInventory = currentInventoryData.variant.inventory_quantity || 0
        const newInventoryQuantity = realCurrentInventory + item.quantityApproved

        console.log('=== INVENTARIO REAL CONSULTADO ===')
        console.log('Inventario real actual:', realCurrentInventory)
        console.log('Nuevo inventario calculado:', newInventoryQuantity)

        // PASO 3B: Actualizar inventario
        const updateUrl = `https://${shopifyDomain}/admin/api/2023-10/variants/${targetVariant.id}.json`
        const updatePayload = {
          variant: {
            id: targetVariant.id,
            inventory_quantity: newInventoryQuantity
          }
        }

        console.log('=== REQUEST A SHOPIFY ===')
        console.log('URL:', updateUrl)
        console.log('Payload:', JSON.stringify(updatePayload, null, 2))

        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        })

        console.log('=== RESPONSE DE SHOPIFY ===')
        console.log('Status:', updateResponse.status)
        console.log('Headers:', Object.fromEntries(updateResponse.headers.entries()))

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text()
          console.error('Error response body:', errorText)
          throw new Error(`Error actualizando inventario: ${updateResponse.status} - ${errorText}`)
        }

        const updateData = await updateResponse.json()
        console.log('Update response data:', JSON.stringify(updateData, null, 2))

        // PASO 3C: VERIFICACIÓN POST-ACTUALIZACIÓN - Consultar nuevamente para confirmar
        console.log('=== VERIFICACIÓN POST-ACTUALIZACIÓN ===')
        
        const verificationResponse = await fetch(currentInventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (!verificationResponse.ok) {
          console.error('Error en verificación post-actualización')
          throw new Error(`Error verificando actualización: ${verificationResponse.status}`)
        }

        const verificationData = await verificationResponse.json()
        const finalInventory = verificationData.variant.inventory_quantity || 0

        console.log('=== RESULTADO DE VERIFICACIÓN ===')
        console.log('Inventario antes:', realCurrentInventory)
        console.log('Inventario esperado:', newInventoryQuantity)
        console.log('Inventario real final:', finalInventory)

        // Verificar si la actualización realmente se aplicó
        if (finalInventory !== newInventoryQuantity) {
          console.error('❌ SINCRONIZACIÓN FALLIDA - Inventario no cambió')
          console.error(`Esperado: ${newInventoryQuantity}, Real: ${finalInventory}`)
          
          throw new Error(
            `Shopify no aplicó la actualización correctamente. ` +
            `Esperado: ${newInventoryQuantity}, Real: ${finalInventory}. ` +
            `Posible problema de permisos o rate limiting.`
          )
        }

        console.log('✅ SINCRONIZACIÓN EXITOSA VERIFICADA')

        syncResults.push({
          sku: item.skuVariant,
          status: 'success',
          previousQuantity: realCurrentInventory,
          addedQuantity: item.quantityApproved,
          newQuantity: finalInventory,
          verifiedQuantity: finalInventory,
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

    // Marcar entrega como sincronizada solo si TODO fue exitoso Y verificado
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
      // Registrar mensaje de error detallado
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
      diagnostics: {
        authentication_verified: true,
        total_variants_in_shopify: allShopifyVariants.size,
        all_skus_found: true,
        post_update_verification: 'enabled'
      }
    }

    console.log('=== SYNC COMPLETADO ===')
    console.log('Summary:', response.summary)
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error general en sincronización:', error)
    
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
