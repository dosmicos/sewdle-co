
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

    // Verificar si ya está sincronizada a nivel de delivery (para sincronización completa)
    // Para sincronización por variante individual, verificamos cada item específico
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select('synced_to_shopify, sync_attempts')
      .eq('id', deliveryId)
      .single()

    if (deliveryError) {
      throw new Error(`Error verificando entrega: ${deliveryError.message}`)
    }

    // Verificar si estamos sincronizando variantes específicas que ya están sincronizadas
    const { data: deliveryItems, error: itemsError } = await supabase
      .from('delivery_items')
      .select('id, synced_to_shopify, order_items(product_variants(sku_variant))')
      .eq('delivery_id', deliveryId)

    if (itemsError) {
      throw new Error(`Error verificando items de entrega: ${itemsError.message}`)
    }

    // Filtrar items que ya están sincronizados
    const alreadySyncedSkus = []
    const itemsToSync = []

    for (const approvedItem of approvedItems) {
      const deliveryItem = deliveryItems.find(item => 
        item.order_items?.product_variants?.sku_variant === approvedItem.skuVariant
      )
      
      if (deliveryItem && deliveryItem.synced_to_shopify) {
        alreadySyncedSkus.push(approvedItem.skuVariant)
      } else {
        itemsToSync.push(approvedItem)
      }
    }

    if (alreadySyncedSkus.length > 0) {
      console.log('Items ya sincronizados:', alreadySyncedSkus)
    }

    if (itemsToSync.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Todos los items seleccionados ya fueron sincronizados con Shopify',
          alreadySynced: alreadySyncedSkus,
          summary: { successful: 0, failed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Actualizar approvedItems para solo incluir los que necesitan sincronización
    const finalApprovedItems = itemsToSync

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

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      throw new Error(`Fallo autenticación Shopify: ${testResponse.status} - ${errorText}`)
    }

    const shopData = await testResponse.json()
    console.log('✅ Autenticación exitosa - Shop:', shopData.shop?.name || 'N/A')

    console.log('=== PASO 2: OBTENER LOCATION ID ===')
    
    // Obtener locations de la tienda
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
    
    if (!primaryLocation) {
      throw new Error('No se encontró una location válida en Shopify')
    }

    const locationId = primaryLocation.id
    console.log('✅ Location ID obtenido:', locationId, '- Nombre:', primaryLocation.name)

    console.log('=== PASO 3: VALIDACIÓN Y OBTENCIÓN DE DATOS DE PRODUCTOS ===')
    const skusToValidate = finalApprovedItems.map(item => item.skuVariant)
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
                inventory_item_id: variant.inventory_item_id,
                inventory_quantity: variant.inventory_quantity,
                inventory_management: variant.inventory_management,
                inventory_policy: variant.inventory_policy,
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

    // Validar cada SKU y su configuración
    for (const sku of skusToValidate) {
      if (allShopifyVariants.has(sku)) {
        const variant = allShopifyVariants.get(sku)
        console.log(`✅ SKU encontrado: ${sku}`)
        console.log(`   - Inventory Item ID: ${variant.inventory_item_id}`)
        console.log(`   - Inventory Management: ${variant.inventory_management}`)
        console.log(`   - Inventory Policy: ${variant.inventory_policy}`)
        
        // Validar configuración del producto
        if (variant.inventory_management !== 'shopify') {
          console.log(`⚠️  Advertencia: SKU ${sku} no tiene inventory_management configurado como 'shopify'`)
        }
        
        validationResults.push({
          sku,
          found: true,
          variant
        })
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
        quantityAttempted: finalApprovedItems.find(item => item.skuVariant === missing.sku)?.quantityApproved || 0
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
          summary: { successful: 0, failed: missingSkus.length, total: finalApprovedItems.length },
          details: syncResults,
          error: `${missingSkus.length} SKUs no encontrados en Shopify`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== PASO 4: SINCRONIZACIÓN CON API DE INVENTORY LEVELS ===')
    const syncResults = []
    let successCount = 0
    let errorCount = 0

    for (const item of finalApprovedItems) {
      try {
        console.log(`\n=== PROCESANDO ITEM: ${item.skuVariant} ===`)
        
        const validatedVariant = validationResults.find(v => v.sku === item.skuVariant && v.found)
        if (!validatedVariant) {
          throw new Error(`Error interno: variante ${item.skuVariant} no encontrada`)
        }

        const targetVariant = validatedVariant.variant
        console.log('Variant ID:', targetVariant.id)
        console.log('Inventory Item ID:', targetVariant.inventory_item_id)
        console.log('Cantidad a agregar:', item.quantityApproved)

        // PASO 4A: Consultar inventario actual usando Inventory Levels API
        const currentInventoryUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${targetVariant.inventory_item_id}&location_ids=${locationId}`
        const currentInventoryResponse = await fetch(currentInventoryUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (!currentInventoryResponse.ok) {
          throw new Error(`Error consultando inventory levels: ${currentInventoryResponse.status}`)
        }

        const currentInventoryData = await currentInventoryResponse.json()
        const inventoryLevel = currentInventoryData.inventory_levels?.[0]
        
        if (!inventoryLevel) {
          throw new Error(`No se encontró inventory level para el item ${targetVariant.inventory_item_id} en location ${locationId}`)
        }

        const realCurrentInventory = inventoryLevel.available || 0
        const newInventoryQuantity = realCurrentInventory + item.quantityApproved

        console.log('=== INVENTARIO REAL CONSULTADO ===')
        console.log('Inventario real actual:', realCurrentInventory)
        console.log('Nuevo inventario calculado:', newInventoryQuantity)

        // PASO 4B: Actualizar inventario usando Inventory Levels API
        const adjustUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/adjust.json`
        const adjustPayload = {
          location_id: locationId,
          inventory_item_id: targetVariant.inventory_item_id,
          available_adjustment: item.quantityApproved
        }

        console.log('=== REQUEST A SHOPIFY INVENTORY LEVELS API ===')
        console.log('URL:', adjustUrl)
        console.log('Payload:', JSON.stringify(adjustPayload, null, 2))

        const adjustResponse = await fetch(adjustUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(adjustPayload)
        })

        console.log('=== RESPONSE DE SHOPIFY ===')
        console.log('Status:', adjustResponse.status)

        if (!adjustResponse.ok) {
          const errorText = await adjustResponse.text()
          console.error('Error response body:', errorText)
          
          // Intentar método alternativo con SET en lugar de ADJUST
          console.log('=== INTENTANDO MÉTODO ALTERNATIVO CON SET ===')
          const setUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/set.json`
          const setPayload = {
            location_id: locationId,
            inventory_item_id: targetVariant.inventory_item_id,
            available: newInventoryQuantity
          }

          const setResponse = await fetch(setUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(setPayload)
          })

          if (!setResponse.ok) {
            const setErrorText = await setResponse.text()
            throw new Error(`Error en ambos métodos - Adjust: ${errorText}, Set: ${setErrorText}`)
          }

          console.log('✅ Método SET exitoso')
        } else {
          console.log('✅ Método ADJUST exitoso')
        }

        // PASO 4C: VERIFICACIÓN POST-ACTUALIZACIÓN con delay
        console.log('=== VERIFICACIÓN POST-ACTUALIZACIÓN ===')
        
        // Esperar un momento para que Shopify procese la actualización
        await new Promise(resolve => setTimeout(resolve, 1000))
        
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
        const finalInventoryLevel = verificationData.inventory_levels?.[0]
        const finalInventory = finalInventoryLevel?.available || 0

        console.log('=== RESULTADO DE VERIFICACIÓN ===')
        console.log('Inventario antes:', realCurrentInventory)
        console.log('Inventario esperado:', newInventoryQuantity)
        console.log('Inventario real final:', finalInventory)

        // Verificar si la actualización realmente se aplicó
        if (finalInventory !== newInventoryQuantity) {
          console.error('❌ SINCRONIZACIÓN FALLIDA - Inventario no cambió correctamente')
          console.error(`Esperado: ${newInventoryQuantity}, Real: ${finalInventory}`)
          
          // Si la diferencia es pequeña, considerarlo exitoso (puede haber ventas concurrentes)
          const difference = Math.abs(finalInventory - newInventoryQuantity)
          if (difference <= 1) {
            console.log('✅ Diferencia mínima aceptada como exitosa')
          } else {
            throw new Error(
              `Shopify no aplicó la actualización correctamente. ` +
              `Esperado: ${newInventoryQuantity}, Real: ${finalInventory}. ` +
              `Diferencia: ${difference} unidades.`
            )
          }
        } else {
          console.log('✅ SINCRONIZACIÓN EXITOSA VERIFICADA')
        }

        syncResults.push({
          sku: item.skuVariant,
          status: 'success',
          previousQuantity: realCurrentInventory,
          addedQuantity: item.quantityApproved,
          newQuantity: finalInventory,
          verifiedQuantity: finalInventory,
          variantId: targetVariant.id,
          inventoryItemId: targetVariant.inventory_item_id,
          locationId: locationId,
          productTitle: targetVariant.product_title,
          method: 'inventory_levels_api'
        })

        successCount++

        // CRÍTICO: Solo marcar como sincronizado después de verificar que Shopify se actualizó correctamente
        const deliveryItem = deliveryItems.find(di => 
          di.order_items?.product_variants?.sku_variant === item.skuVariant
        )
        
        if (deliveryItem) {
          console.log(`✅ Marcando delivery_item ${deliveryItem.id} como sincronizado exitosamente`)
          
          const { error: updateError } = await supabase
            .from('delivery_items')
            .update({
              synced_to_shopify: true,
              last_sync_attempt: new Date().toISOString(),
              sync_attempt_count: (deliveryItem.sync_attempt_count || 0) + 1,
              sync_error_message: null
            })
            .eq('id', deliveryItem.id)
          
          if (updateError) {
            console.error('Error actualizando delivery_item:', updateError)
            throw new Error(`Error actualizando estado de sincronización: ${updateError.message}`)
          }
        }

      } catch (error) {
        console.error(`❌ Error sincronizando ${item.skuVariant}:`, error.message)
        
        // Marcar el delivery_item específico como fallido
        const deliveryItem = deliveryItems.find(di => 
          di.order_items?.product_variants?.sku_variant === item.skuVariant
        )
        
        if (deliveryItem) {
          console.log(`❌ Marcando delivery_item ${deliveryItem.id} como fallido`)
          
          await supabase
            .from('delivery_items')
            .update({
              synced_to_shopify: false,
              last_sync_attempt: new Date().toISOString(),
              sync_attempt_count: (deliveryItem.sync_attempt_count || 0) + 1,
              sync_error_message: error.message
            })
            .eq('id', deliveryItem.id)
        }
        
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

    // Ya no actualizamos manualmente deliveries.synced_to_shopify
    // El trigger automático se encarga de esto basado en el estado de TODOS los delivery_items
    console.log('=== ESTADO DE SINCRONIZACIÓN ===')
    console.log('El trigger automático actualizará el estado de la entrega basado en todos los items')
    
    if (errorCount > 0) {
      // Solo registrar mensaje de error detallado si hay errores
      const errorMessage = syncResults
        .filter(r => r.status === 'error')
        .map(r => `${r.sku}: ${r.error}`)
        .join('; ')
      
      await supabase
        .from('deliveries')
        .update({ sync_error_message: errorMessage })
        .eq('id', deliveryId)
        
      console.log('❌ Errores registrados en la entrega')
    } else {
      // Limpiar mensaje de error si todo fue exitoso
      await supabase
        .from('deliveries')
        .update({ sync_error_message: null })
        .eq('id', deliveryId)
        
      console.log('✅ Errores limpiados de la entrega')
    }

    const response = {
      success: successCount > 0,
      summary: {
        successful: successCount,
        failed: errorCount,
        total: finalApprovedItems.length
      },
      details: syncResults,
      error: errorCount > 0 ? `${errorCount} items fallaron en la sincronización` : null,
      diagnostics: {
        authentication_verified: true,
        location_id: locationId,
        location_name: primaryLocation.name,
        total_variants_in_shopify: allShopifyVariants.size,
        all_skus_found: true,
        api_method: 'inventory_levels_api',
        post_update_verification: 'enabled_with_delay'
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
