
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuthenticatedUser } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type ApprovedItem = {
  skuVariant: string
  quantityApproved: number
}

type SyncResultEntry = {
  sku?: string
  status?: string
  addedQuantity?: number
}

type SyncResultsPayload = {
  results?: SyncResultEntry[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

// Rate limiting configuration
const SHOPIFY_API_RATE_LIMIT = {
  MAX_CALLS_PER_SECOND: 1,
  DELAY_BETWEEN_CALLS: 1100, // 1.1 seconds to be safe
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000 // 5 seconds
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to retry API calls with exponential backoff
const retryWithBackoff = async <T>(fn: () => Promise<T>, maxRetries = SHOPIFY_API_RATE_LIMIT.MAX_RETRIES): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      return result
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      console.log(`Attempt ${attempt} failed:`, errorMessage)
      
      // Check if it's a rate limit error
      if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('Exceeded')) {
        if (attempt < maxRetries) {
          const delayTime = SHOPIFY_API_RATE_LIMIT.RETRY_DELAY * Math.pow(2, attempt - 1)
          console.log(`Rate limit hit, waiting ${delayTime}ms before retry ${attempt + 1}/${maxRetries}`)
          await delay(delayTime)
          continue
        }
      }
      
      // For non-rate-limit errors or final attempt, throw the error
      if (error instanceof Error) {
        throw error
      }
      throw new Error(errorMessage)
    }
  }
  throw new Error('Unexpected retry termination')
}

// Helper function to generate a sync fingerprint for idempotency
const generateSyncFingerprint = (deliveryId: string, skuVariant: string, quantityApproved: number) => {
  return `${deliveryId}-${skuVariant}-${quantityApproved}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let deliveryId = null
  let supabase = null
  let lockAcquired = false

  try {
    const authResult = await requireAuthenticatedUser(req, corsHeaders)
    if (!authResult.ok) {
      return authResult.response
    }
    console.log('✅ Authenticated user for sync-inventory-shopify:', authResult.userId)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request data early to get deliveryId
    const requestData = await req.json()
    deliveryId = requestData.deliveryId

    if (!deliveryId) {
      throw new Error('Delivery ID es requerido')
    }

    // STEP 0: ACQUIRE ADVISORY LOCK
    console.log('=== PASO 0: ADQUISICIÓN DE BLOQUEO DE SINCRONIZACIÓN ===')
    console.log('Intentando adquirir bloqueo para delivery:', deliveryId)
    
    const { data: lockResult, error: lockError } = await supabase.rpc('acquire_delivery_sync_lock', {
      delivery_uuid: deliveryId
    })

    if (lockError) {
      throw new Error(`Error al intentar adquirir bloqueo: ${lockError.message}`)
    }

    if (!lockResult) {
      console.log('❌ No se pudo adquirir el bloqueo - otra sincronización está en progreso')
      
      // Check existing lock info
      const { data: deliveryInfo } = await supabase
        .from('deliveries')
        .select('tracking_number, sync_lock_acquired_at, sync_lock_acquired_by')
        .eq('id', deliveryId)
        .single()

      return new Response(
        JSON.stringify({
          success: false,
          error: 'sync_in_progress',
          message: 'Una sincronización ya está en progreso para esta entrega',
          details: {
            delivery_id: deliveryId,
            tracking_number: deliveryInfo?.tracking_number,
            lock_acquired_at: deliveryInfo?.sync_lock_acquired_at,
            lock_acquired_by: deliveryInfo?.sync_lock_acquired_by
          }
        }),
        { 
          status: 409,  // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    lockAcquired = true
    console.log('✅ Bloqueo adquirido exitosamente para delivery:', deliveryId)

    // Update delivery with lock info
    await supabase
      .from('deliveries')
      .update({
        sync_lock_acquired_at: new Date().toISOString(),
        sync_lock_acquired_by: 'sync-inventory-shopify' // In a real app, this could be user_id
      })
      .eq('id', deliveryId)

    // Get Shopify credentials from environment OR organization
    let rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    let shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    // Fallback: Get from organization if not in env
    if (!rawShopifyDomain || !shopifyToken) {
      console.log('🔍 Intentando obtener credenciales de la organización...')
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('shopify_store_url, shopify_credentials')
        .eq('name', 'Dosmicos')
        .single()

      if (orgError || !org) {
        throw new Error('No se pudieron obtener credenciales de Shopify de la organización')
      }

      if (org.shopify_store_url && org.shopify_credentials?.access_token) {
        // Extract domain from URL
        const url = new URL(org.shopify_store_url)
        rawShopifyDomain = url.hostname.replace('.myshopify.com', '')
        shopifyToken = org.shopify_credentials.access_token
        console.log('✅ Credenciales obtenidas de la organización')
      } else {
        throw new Error('Credenciales de Shopify no configuradas en la organización')
      }
    }

    if (!rawShopifyDomain || !shopifyToken) {
      throw new Error('Credenciales de Shopify no configuradas')
    }

    // Normalize Shopify domain - CORREGIDO para asegurar formato correcto
    const shopifyDomain = rawShopifyDomain.includes('.myshopify.com') 
      ? rawShopifyDomain
      : rawShopifyDomain + '.myshopify.com'

    console.log('=== SHOPIFY SYNC INICIADO ===')
    console.log('Domain:', shopifyDomain)
    console.log('Token presente:', shopifyToken ? 'Sí' : 'No')

    const approvedItems = requestData.approvedItems as ApprovedItem[]
    const intelligentSync = requestData.intelligentSync || false

    if (!approvedItems || !Array.isArray(approvedItems)) {
      throw new Error('Datos de sincronización inválidos')
    }

    console.log('=== DATOS DE ENTRADA ===')
    console.log('Delivery ID:', deliveryId)
    console.log('Items a sincronizar:', approvedItems.length)
    console.log('Intelligent Sync:', intelligentSync)
    console.log('Items:', JSON.stringify(approvedItems, null, 2))

    console.log('=== VERIFICACIÓN SIMPLIFICADA ===')
    
    // Simplified approach: No delivery-level locks, rely on SKU-level verification
    const { data: existingSync, error: syncCheckError } = await supabase
      .from('deliveries')
      .select('synced_to_shopify, sync_error_message')
      .eq('id', deliveryId)
      .single()

    if (syncCheckError) {
      throw new Error(`Error verificando estado de sincronización: ${syncCheckError.message}`)
    }

    console.log('=== PASO 1: VERIFICACIÓN DE AUTENTICACIÓN ===')
    
    // Test authentication with retry logic
    const shopData = await retryWithBackoff(async () => {
      const testUrl = `https://${shopifyDomain}/admin/api/2023-10/shop.json`
      console.log(`🧪 Probando autenticación con URL: ${testUrl}`)
      const testResponse = await fetch(testUrl, {
        headers: {
          'X-Shopify-Access-Token': shopifyToken,
          'Content-Type': 'application/json',
        },
      })

      if (!testResponse.ok) {
        const errorText = await testResponse.text()
        throw new Error(`Fallo autenticación Shopify (${testResponse.status}): ${errorText}`)
      }

      return await testResponse.json()
    })

    console.log('✅ Autenticación exitosa - Shop:', shopData.shop?.name || 'N/A')

    console.log('=== PASO 2: OBTENER LOCATION ID ===')
    
    const locationsData = await retryWithBackoff(async () => {
      await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
      
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

      return await locationsResponse.json()
    })

    const primaryLocation = locationsData.locations.find(loc => loc.legacy || loc.primary) || locationsData.locations[0]
    
    if (!primaryLocation) {
      throw new Error('No se encontró una location válida en Shopify')
    }

    const locationId = primaryLocation.id
    console.log('✅ Location ID obtenido:', locationId, '- Nombre:', primaryLocation.name)

    console.log('=== PASO 3: INTELLIGENT SYNC CHECK ===')
    
    // Get delivery items with enhanced fingerprinting
    const { data: deliveryItems, error: itemsError } = await supabase
      .from('delivery_items')
      .select(`
        id, 
        synced_to_shopify, 
        quantity_approved, 
        sync_attempt_count, 
        
        order_items(
          product_variants(sku_variant)
        )
      `)
      .eq('delivery_id', deliveryId)

    if (itemsError) {
      throw new Error(`Error verificando items de entrega: ${itemsError.message}`)
    }

    // Si es sync inteligente, verificar qué SKUs ya fueron sincronizados
    const alreadySyncedSkus: Array<{ sku: string; reason: string; quantityApproved: number }> = []
    const itemsToSync: ApprovedItem[] = []

    if (intelligentSync) {
      console.log('🧠 Modo Sync Inteligente - Verificando estado individual de cada SKU')
      
      // Obtener logs de sincronización previos para verificar SKUs individuales
      const { data: syncLogs, error: logsError } = await supabase
        .from('inventory_sync_logs')
        .select('sync_results, synced_at, verification_status')
        .eq('delivery_id', deliveryId)
        .eq('verification_status', 'verified')
        .order('synced_at', { ascending: false })

      if (logsError) {
        console.warn('Error al obtener logs de sincronización:', logsError.message)
      }

      for (const approvedItem of approvedItems) {
        let shouldSkip = false;
        let skipReason = '';

        // Verificar si este SKU específico ya fue sincronizado exitosamente
        if (syncLogs && syncLogs.length > 0) {
          for (const log of syncLogs) {
            if (log.sync_results && typeof log.sync_results === 'object') {
              const syncResults = log.sync_results as SyncResultsPayload
              if (syncResults.results && Array.isArray(syncResults.results)) {
                const skuResult = syncResults.results.find((r) => 
                  r.sku === approvedItem.skuVariant && 
                  r.status === 'success' && 
                  r.addedQuantity === approvedItem.quantityApproved
                );
                
                if (skuResult) {
                  shouldSkip = true;
                  skipReason = `Ya sincronizado el ${new Date(log.synced_at).toLocaleString()} con cantidad ${skuResult.addedQuantity}`;
                  break;
                }
              }
            }
          }
        }

        if (shouldSkip) {
          alreadySyncedSkus.push({
            sku: approvedItem.skuVariant,
            reason: skipReason,
            quantityApproved: approvedItem.quantityApproved
          });
          console.log(`⏭️ Saltando ${approvedItem.skuVariant}: ${skipReason}`);
        } else {
          itemsToSync.push(approvedItem);
          console.log(`✅ ${approvedItem.skuVariant} será sincronizado`);
        }
      }

      console.log(`📊 Resultado Sync Inteligente: ${itemsToSync.length} a sincronizar, ${alreadySyncedSkus.length} ya sincronizados`);
    } else {
      console.log('🔄 Modo Sync Completo - Verificando estado básico')
      
      // Modo normal: usar la lógica original
      for (const approvedItem of approvedItems) {
        const deliveryItem = deliveryItems.find(item => 
          item.order_items?.product_variants?.sku_variant === approvedItem.skuVariant
        )
        
        if (deliveryItem) {
          // Si la cantidad aprobada es 0, marcar como sincronizado automáticamente
          if (approvedItem.quantityApproved === 0) {
            console.log(`✅ SKU ${approvedItem.skuVariant} tiene cantidad 0 - marcando como sincronizado automáticamente`)
            
            // Actualizar el estado del item como sincronizado
            await supabase
              .from('delivery_items')
              .update({
                synced_to_shopify: true,
                sync_error_message: 'Auto-marcado como sincronizado (cantidad 0)'
              })
              .eq('id', deliveryItem.id)

            alreadySyncedSkus.push({
              sku: approvedItem.skuVariant,
              reason: 'quantity_zero_auto_sync',
              fingerprint: generateSyncFingerprint(deliveryId, approvedItem.skuVariant, 0)
            })
            continue
          }
          
          const currentFingerprint = generateSyncFingerprint(deliveryId, approvedItem.skuVariant, approvedItem.quantityApproved)
          // Check if already synced with same quantity (simplified idempotency)
          if (deliveryItem.synced_to_shopify && 
              deliveryItem.quantity_approved === approvedItem.quantityApproved) {
            alreadySyncedSkus.push({
              sku: approvedItem.skuVariant,
              reason: 'recently_synced_same_quantity'
            })
            console.log(`SKU ${approvedItem.skuVariant} ya sincronizado con cantidad ${deliveryItem.quantity_approved}`)
          } else {
            // Needs sync or re-sync
            console.log(`SKU ${approvedItem.skuVariant} necesita sincronización: ${deliveryItem.quantity_approved || 0} -> ${approvedItem.quantityApproved}`)
            itemsToSync.push(approvedItem)
          }
        } else {
          itemsToSync.push(approvedItem)
        }
      }
    }

    if (itemsToSync.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Todos los items seleccionados ya están sincronizados correctamente',
          summary: { successful: 0, failed: 0, already_synced: alreadySyncedSkus.length }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== PASO 4: VALIDACIÓN Y OBTENCIÓN DE DATOS DE PRODUCTOS ===')
    const skusToValidate = itemsToSync.map(item => item.skuVariant)
    const validationResults = []

    // Get ALL Shopify products with variants (with rate limiting)
    const allShopifyVariants = new Map()
    let hasNextPage = true
    let pageInfo = null

    while (hasNextPage) {
      await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
      
      const productsData = await retryWithBackoff(async () => {
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

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Error consultando productos: ${response.status} - ${errorText}`)
        }

        return {
          data: await response.json(),
          linkHeader: response.headers.get('Link')
        }
      })

      productsData.data.products.forEach(product => {
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

      // Check for next page
      const linkHeader = productsData.linkHeader
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
        pageInfo = match ? match[1] : null
      } else {
        hasNextPage = false
      }
    }

    console.log(`Total variantes en Shopify: ${allShopifyVariants.size}`)

    // Validate each SKU
    for (const sku of skusToValidate) {
      if (allShopifyVariants.has(sku)) {
        const variant = allShopifyVariants.get(sku)
        console.log(`✅ SKU encontrado: ${sku}`)
        
        if (variant.inventory_management !== 'shopify') {
          console.log(`⚠️ Advertencia: SKU ${sku} no tiene inventory_management configurado como 'shopify'`)
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

    // Check for missing SKUs
    const missingSkus = validationResults.filter(result => !result.found)
    
    if (missingSkus.length > 0) {
      const errorMessage = `SKUs no encontrados en Shopify: ${missingSkus.map(m => m.sku).join(', ')}`
      
      await supabase
        .from('deliveries')
        .update({ 
          sync_error_message: errorMessage
        })
        .eq('id', deliveryId)

      const syncResults = missingSkus.map(missing => ({
        sku: missing.sku,
        status: 'error',
        error: `SKU '${missing.sku}' no existe en Shopify`,
        quantityAttempted: itemsToSync.find(item => item.skuVariant === missing.sku)?.quantityApproved || 0
      }))

      await supabase.from('inventory_sync_logs').insert([{
        delivery_id: deliveryId,
        sync_results: syncResults,
        success_count: 0,
        error_count: missingSkus.length
      }])

      return new Response(
        JSON.stringify({
          success: false,
          summary: { successful: 0, failed: missingSkus.length, total: itemsToSync.length, already_synced: alreadySyncedSkus.length },
          details: syncResults,
          error: `${missingSkus.length} SKUs no encontrados en Shopify`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('=== PASO 5: SINCRONIZACIÓN CON RATE LIMITING MEJORADO ===')
    const syncResults = []
    let successCount = 0
    let errorCount = 0

    for (const item of itemsToSync) {
      let deliveryItem = null
      
      try {
        console.log(`\n=== PROCESANDO ITEM: ${item.skuVariant} ===`)
        
        // Get corresponding delivery_item
        deliveryItem = deliveryItems.find(di => 
          di.order_items?.product_variants?.sku_variant === item.skuVariant
        )
        
        if (!deliveryItem) {
          throw new Error(`No se encontró delivery_item para SKU ${item.skuVariant}`)
        }

        // Mark as attempting sync
        console.log(`🔄 Actualizando delivery_item ${deliveryItem.id} - intento de sincronización`)
        await supabase
          .from('delivery_items')
          .update({
            synced_to_shopify: false,
            sync_attempt_count: (deliveryItem.sync_attempt_count || 0) + 1,
            sync_error_message: null
          })
          .eq('id', deliveryItem.id)
        
        const validatedVariant = validationResults.find(v => v.sku === item.skuVariant && v.found)
        if (!validatedVariant) {
          throw new Error(`Error interno: variante ${item.skuVariant} no encontrada`)
        }

        const targetVariant = validatedVariant.variant
        console.log('Variant ID:', targetVariant.id)
        console.log('Inventory Item ID:', targetVariant.inventory_item_id)
        console.log('Cantidad a agregar:', item.quantityApproved)

        // RATE LIMITED: Get current inventory
        await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
        
        const currentInventoryData = await retryWithBackoff(async () => {
          const currentInventoryUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${targetVariant.inventory_item_id}&location_ids=${locationId}`
          const response = await fetch(currentInventoryUrl, {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Error consultando inventory levels: ${response.status} - ${errorText}`)
          }

          return await response.json()
        })

        const inventoryLevel = currentInventoryData.inventory_levels?.[0]
        
        if (!inventoryLevel) {
          throw new Error(`No se encontró inventory level para el item ${targetVariant.inventory_item_id} en location ${locationId}`)
        }

        const realCurrentInventory = inventoryLevel.available || 0
        const expectedNewInventory = realCurrentInventory + item.quantityApproved

        console.log('=== VERIFICACIÓN DE IDEMPOTENCIA MEJORADA ===')
        console.log('Inventario actual en Shopify:', realCurrentInventory)
        console.log('Cantidad a agregar:', item.quantityApproved)
        console.log('Inventario esperado después:', expectedNewInventory)

        // Enhanced idempotency check - verify if quantity was already applied
        const previousSyncLogs = await supabase
          .from('inventory_sync_logs')
          .select('sync_results')
          .eq('delivery_id', deliveryId)
          .order('synced_at', { ascending: false })
          .limit(5) // Check last 5 attempts

        let alreadyApplied = false
        for (const log of previousSyncLogs.data || []) {
          const logResults = log.sync_results
          if (logResults && typeof logResults === 'object' && logResults.results && Array.isArray(logResults.results)) {
            const previousSync = logResults.results.find(r => 
              r.sku === item.skuVariant && 
              r.status === 'success' &&
              r.addedQuantity === item.quantityApproved
            )
          
            if (previousSync) {
              // Additional check: verify the current inventory matches expected result
              const expectedFromPrevious = (previousSync.previousQuantity || 0) + item.quantityApproved
              if (Math.abs(realCurrentInventory - expectedFromPrevious) <= 1) { // Allow 1 unit difference
                alreadyApplied = true
                console.log(`✅ Cantidad ya aplicada correctamente, saltando sincronización`)
                break
              }
            }
          }
        }

        if (alreadyApplied) {
          // Mark as successful without changes - IDEMPOTENCY SUCCESS
          await supabase
            .from('delivery_items')
            .update({
              synced_to_shopify: true,
              sync_error_message: null,
              sync_attempt_count: (deliveryItem.sync_attempt_count || 0) // Keep current count
            })
            .eq('id', deliveryItem.id)
          
          console.log(`✅ Item ${item.skuVariant} marcado como sincronizado (idempotencia)`)

          syncResults.push({
            sku: item.skuVariant,
            status: 'success',
            previousQuantity: realCurrentInventory,
            addedQuantity: 0,
            newQuantity: realCurrentInventory,
            verifiedQuantity: realCurrentInventory,
            variantId: targetVariant.id,
            inventoryItemId: targetVariant.inventory_item_id,
            locationId: locationId,
            productTitle: targetVariant.product_title,
            method: 'idempotency_check_enhanced',
            message: 'Ya sincronizado previamente - verificado por inventario actual'
          })

          successCount++
          continue
        }

        // RATE LIMITED: Update inventory using Inventory Levels API
        await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
        
        const inventoryUpdateResult = await retryWithBackoff(async () => {
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

          console.log('Response Status:', adjustResponse.status)

          if (!adjustResponse.ok) {
            const errorText = await adjustResponse.text()
            console.error('Adjust error:', errorText)
            
            // Try SET method as fallback
            console.log('=== INTENTANDO MÉTODO ALTERNATIVO CON SET ===')
            const setUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/set.json`
            const setPayload = {
              location_id: locationId,
              inventory_item_id: targetVariant.inventory_item_id,
              available: expectedNewInventory
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
            return { method: 'set' }
          }

          console.log('✅ Método ADJUST exitoso')
          return { method: 'adjust' }
        })

        // RATE LIMITED: Verify update with extended delay
        console.log('=== VERIFICACIÓN POST-ACTUALIZACIÓN ===')
        await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS * 2) // Double delay for verification
        
        const verificationData = await retryWithBackoff(async () => {
          const verificationUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${targetVariant.inventory_item_id}&location_ids=${locationId}`
          const response = await fetch(verificationUrl, {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Error verificando actualización: ${response.status} - ${errorText}`)
          }

          return await response.json()
        })

        const finalInventoryLevel = verificationData.inventory_levels?.[0]
        const finalInventory = finalInventoryLevel?.available || 0

        console.log('=== RESULTADO DE VERIFICACIÓN ===')
        console.log('Inventario antes:', realCurrentInventory)
        console.log('Inventario esperado:', expectedNewInventory)
        console.log('Inventario real final:', finalInventory)

        // Verify update was applied correctly
        const difference = Math.abs(finalInventory - expectedNewInventory)
        if (difference > 1) {
          console.error('❌ SINCRONIZACIÓN FALLIDA - Inventario no cambió correctamente')
          throw new Error(
            `Shopify no aplicó la actualización correctamente. ` +
            `Esperado: ${expectedNewInventory}, Real: ${finalInventory}. ` +
            `Diferencia: ${difference} unidades.`
          )
        }

        console.log('✅ SINCRONIZACIÓN EXITOSA VERIFICADA')

        // Mark as successfully synced
        await supabase
          .from('delivery_items')
          .update({
            synced_to_shopify: true,
            sync_error_message: null,
            sync_attempt_count: (deliveryItem.sync_attempt_count || 0) // Keep current count for successful syncs
          })
          .eq('id', deliveryItem.id)
        
        console.log(`✅ Item ${item.skuVariant} marcado como sincronizado (nueva sincronización)`)

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
          method: inventoryUpdateResult.method === 'set' ? 'inventory_levels_set' : 'inventory_levels_adjust'
        })

        successCount++

      } catch (error) {
        console.error(`❌ Error sincronizando ${item.skuVariant}:`, error.message)
        
        // Mark delivery_item as failed
        if (deliveryItem) {
          await supabase
            .from('delivery_items')
            .update({
              synced_to_shopify: false,
              sync_error_message: error.message,
              sync_attempt_count: (deliveryItem.sync_attempt_count || 0) + 1 // Increment on failure
            })
            .eq('id', deliveryItem.id)
          
          console.log(`❌ Item ${item.skuVariant} marcado como fallido: ${error.message}`)
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

    // Log results with verification status and intelligent sync info
    const logData = {
      delivery_id: deliveryId,
      sync_results: {
        results: syncResults,
        intelligent_sync: intelligentSync,
        skipped_items: alreadySyncedSkus,
        total_items_sent: approvedItems.length,
        items_processed: itemsToSync.length
      },
      success_count: successCount,
      error_count: errorCount,
      verification_status: errorCount === 0 ? 'verified' : 'failed',
      mathematical_verification: {
        total_items_processed: successCount + errorCount,
        items_verified: successCount,
        items_failed: errorCount,
        items_skipped: alreadySyncedSkus.length,
        verification_passed: errorCount === 0,
        intelligent_sync_enabled: intelligentSync
      }
    }

    await supabase.from('inventory_sync_logs').insert([logData])

    // Update delivery sync status comprehensively
    const totalItems = successCount + errorCount + alreadySyncedSkus.length
    const allItemsProcessed = successCount + alreadySyncedSkus.length
    const deliveryFullySynced = allItemsProcessed === totalItems && errorCount === 0
    
    console.log(`📊 Delivery Sync Status: ${allItemsProcessed}/${totalItems} items synced, ${errorCount} errors`)
    
    await supabase
      .from('deliveries')
      .update({ 
        synced_to_shopify: deliveryFullySynced,
        sync_error_message: errorCount > 0 ? 
          syncResults.filter(r => r.status === 'error').map(r => `${r.sku}: ${r.error}`).join('; ') :
          null
      })
      .eq('id', deliveryId)
      
    console.log(`✅ Delivery ${deliveryId} sync status updated: ${deliveryFullySynced ? 'FULLY_SYNCED' : 'PARTIAL_OR_FAILED'}`)

    const response = {
      success: successCount > 0 || (alreadySyncedSkus.length > 0 && errorCount === 0),
      summary: {
        successful: successCount,
        failed: errorCount,
        total: itemsToSync.length,
        already_synced: alreadySyncedSkus.length,
        total_requested: approvedItems.length,
        skipped: alreadySyncedSkus.length
      },
      details: syncResults,
      skipped_details: alreadySyncedSkus,
      error: errorCount > 0 ? `${errorCount} items fallaron en la sincronización` : null,
      message: intelligentSync ? 
        `Sync inteligente: ${successCount} sincronizados, ${alreadySyncedSkus.length} ya estaban sincronizados, ${errorCount} fallaron` :
        `Sync completo: ${successCount} sincronizados, ${alreadySyncedSkus.length} ya estaban sincronizados, ${errorCount} fallaron`,
      diagnostics: {
        authentication_verified: true,
        location_id: locationId,
        location_name: primaryLocation.name,
        total_variants_in_shopify: allShopifyVariants.size,
        all_skus_found: true,
        api_method: 'inventory_levels_api_with_rate_limiting',
        intelligent_sync_enabled: intelligentSync,
        rate_limiting: {
          delay_between_calls: SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS,
          max_retries: SHOPIFY_API_RATE_LIMIT.MAX_RETRIES,
          retry_delay: SHOPIFY_API_RATE_LIMIT.RETRY_DELAY
        },
        idempotency_check: 'enhanced_with_fingerprinting',
        duplicate_prevention: 'enabled_with_inventory_verification'
      }
    }

    console.log('=== SYNC COMPLETADO CON RATE LIMITING ===')
    console.log('Summary:', response.summary)
    
    // RELEASE ADVISORY LOCK
    if (lockAcquired && deliveryId) {
      console.log('🔓 Liberando bloqueo de sincronización...')
      try {
        await supabase.rpc('release_delivery_sync_lock', { delivery_uuid: deliveryId })
        await supabase
          .from('deliveries')
          .update({
            sync_lock_acquired_at: null,
            sync_lock_acquired_by: null
          })
          .eq('id', deliveryId)
        console.log('✅ Bloqueo liberado exitosamente')
      } catch (lockError) {
        console.error('⚠️ Error al liberar bloqueo:', lockError)
      }
    }
    
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error general en sincronización:', error)
    
    // RELEASE ADVISORY LOCK ON ERROR
    if (lockAcquired && deliveryId && supabase) {
      console.log('🔓 Liberando bloqueo debido a error...')
      try {
        await supabase.rpc('release_delivery_sync_lock', { delivery_uuid: deliveryId })
        await supabase
          .from('deliveries')
          .update({
            sync_lock_acquired_at: null,
            sync_lock_acquired_by: null,
            sync_error_message: error.message
          })
          .eq('id', deliveryId)
        console.log('✅ Bloqueo liberado después de error')
      } catch (lockError) {
        console.error('⚠️ Error al liberar bloqueo en cleanup:', lockError)
        // Still try to update error message
        try {
          await supabase
            .from('deliveries')
            .update({ sync_error_message: error.message })
            .eq('id', deliveryId)
        } catch (updateError) {
          console.error('Error actualizando mensaje de error:', updateError)
        }
      }
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        summary: { successful: 0, failed: 0, already_synced: 0 }
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
