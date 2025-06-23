
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

    const syncResults = []
    let successCount = 0
    let errorCount = 0

    // Procesar cada item aprobado
    for (const item of approvedItems) {
      try {
        console.log(`Sincronizando item: ${item.skuVariant}, cantidad: ${item.quantityApproved}`)
        
        // Buscar el producto por SKU en Shopify
        const searchUrl = `https://${shopifyDomain}/admin/api/2023-10/products.json?fields=id,variants&limit=250`
        const searchResponse = await fetch(searchUrl, {
          headers: {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json',
          },
        })

        if (!searchResponse.ok) {
          throw new Error(`Error buscando productos: ${searchResponse.status} ${searchResponse.statusText}`)
        }

        const searchData = await searchResponse.json()
        console.log(`Encontrados ${searchData.products?.length || 0} productos en Shopify`)

        // Buscar la variante específica
        let targetVariant = null
        for (const product of searchData.products || []) {
          for (const variant of product.variants || []) {
            if (variant.sku === item.skuVariant) {
              targetVariant = variant
              break
            }
          }
          if (targetVariant) break
        }

        if (!targetVariant) {
          throw new Error(`Variante con SKU ${item.skuVariant} no encontrada en Shopify`)
        }

        console.log(`Variante encontrada: ID ${targetVariant.id}, inventario actual: ${targetVariant.inventory_quantity}`)

        // Actualizar inventario en Shopify
        const newInventoryQuantity = (targetVariant.inventory_quantity || 0) + item.quantityApproved
        
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
          throw new Error(`Error actualizando inventario: ${updateResponse.status} ${errorText}`)
        }

        const updateData = await updateResponse.json()
        console.log(`Inventario actualizado para ${item.skuVariant}: ${targetVariant.inventory_quantity} -> ${updateData.variant.inventory_quantity}`)

        syncResults.push({
          sku: item.skuVariant,
          status: 'success',
          previousQuantity: targetVariant.inventory_quantity,
          addedQuantity: item.quantityApproved,
          newQuantity: updateData.variant.inventory_quantity,
          variantId: targetVariant.id
        })

        successCount++

      } catch (error) {
        console.error(`Error sincronizando ${item.skuVariant}:`, error.message)
        
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
      
      console.log(`Entrega ${deliveryId} marcada como sincronizada`)
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

    console.log('Sync completed:', response.summary)

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en sincronización:', error)
    
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
