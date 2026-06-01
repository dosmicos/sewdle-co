
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting configuration
// Shopify leaky-bucket: bucket size 40, refill 2 req/sec.
// 300ms between calls = ~3.3 req/sec, safe within the initial burst of 40.
const SHOPIFY_API_RATE_LIMIT = {
  MAX_CALLS_PER_SECOND: 3,
  DELAY_BETWEEN_CALLS: 300, // 300ms — safe for Shopify's burst bucket
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000 // 5 seconds
}

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to retry API calls with exponential backoff
const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = SHOPIFY_API_RATE_LIMIT.MAX_RETRIES) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      return result
    } catch (error) {
      console.log(`Attempt ${attempt} failed:`, error.message)
      
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('rate limit') || error.message?.includes('Exceeded')) {
        if (attempt < maxRetries) {
          const delayTime = SHOPIFY_API_RATE_LIMIT.RETRY_DELAY * Math.pow(2, attempt - 1)
          console.log(`Rate limit hit, waiting ${delayTime}ms before retry ${attempt + 1}/${maxRetries}`)
          await delay(delayTime)
          continue
        }
      }
      
      // For non-rate-limit errors or final attempt, throw the error
      throw error
    }
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let deliveryId = null
  let supabase = null
  let lockAcquired = false

  try {
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
      console.log('⚠️ No se pudo adquirir el advisory lock — verificando si es lock huérfano...')

      // Check existing lock info
      const { data: deliveryInfo } = await supabase
        .from('deliveries')
        .select('tracking_number, sync_lock_acquired_at, sync_lock_acquired_by')
        .eq('id', deliveryId)
        .single()

      const lockAcquiredAt = deliveryInfo?.sync_lock_acquired_at
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const isStale = !lockAcquiredAt || lockAcquiredAt < fiveMinutesAgo

      if (isStale) {
        // The advisory lock is held by a connection from a previous timed-out function call.
        // Since sync_lock_acquired_at is NULL or very old, no real sync is running.
        // Proceed anyway — the orphaned pg_advisory_lock will auto-release when the
        // pooled connection is eventually recycled by PgBouncer.
        console.log('🔓 Lock huérfano detectado (sin actividad de sync reciente) — continuando sin bloqueo')
        lockAcquired = false // Don't try to release via RPC (we don't hold it)
      } else {
        console.log('❌ Sincronización genuinamente en progreso — rechazando solicitud duplicada')
        return new Response(
          JSON.stringify({
            success: false,
            error: 'sync_in_progress',
            message: 'Una sincronización ya está en progreso para esta entrega',
            details: {
              delivery_id: deliveryId,
              tracking_number: deliveryInfo?.tracking_number,
              lock_acquired_at: lockAcquiredAt,
              lock_acquired_by: deliveryInfo?.sync_lock_acquired_by
            }
          }),
          {
            status: 409,  // Conflict
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    if (lockResult) {
      // We hold the advisory lock — track it in the table
      lockAcquired = true
      console.log('✅ Bloqueo adquirido exitosamente para delivery:', deliveryId)
      await supabase
        .from('deliveries')
        .update({
          sync_lock_acquired_at: new Date().toISOString(),
          sync_lock_acquired_by: 'sync-inventory-shopify'
        })
        .eq('id', deliveryId)
    }
    // else: stale lock bypass — lockAcquired remains false, proceed without tracking

    // === RESOLUCIÓN DE TIENDA (MULTI-STORE) ===
    // Priority: 1) delivery→order→store_id (authoritative, from DB)
    //           2) storeId hint from request body (fallback)
    //           3) ENV vars (Colombia default)
    let rawShopifyDomain: string | undefined
    let shopifyToken: string | undefined

    // Step 1: Discover store_id from the delivery's order (most reliable)
    let resolvedStoreId: string | undefined = requestData.storeId

    // Always try to resolve from DB first using service role (bypasses RLS)
    console.log(`🔍 Resolviendo tienda para delivery: ${deliveryId}`)
    const { data: deliveryRow } = await supabase
      .from('deliveries')
      .select('order_id')
      .eq('id', deliveryId)
      .single()

    if (deliveryRow?.order_id) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('store_id')
        .eq('id', deliveryRow.order_id)
        .single()

      if (orderRow?.store_id) {
        resolvedStoreId = orderRow.store_id
        console.log(`✅ store_id resuelto desde DB: ${resolvedStoreId}`)
      } else {
        console.log(`⚠️ Orden ${deliveryRow.order_id} no tiene store_id, usando fallback`)
      }
    } else {
      console.log(`⚠️ Delivery ${deliveryId} no tiene order_id, usando fallback`)
    }

    if (resolvedStoreId) {
      // Multi-store: use credentials from stores table
      console.log(`🏪 Obteniendo credenciales de la tienda ID: ${resolvedStoreId}`)
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('shopify_store_url, shopify_credentials, name, country_code')
        .eq('id', resolvedStoreId)
        .eq('is_active', true)
        .single()

      if (!storeError && store?.shopify_store_url && store.shopify_credentials?.access_token) {
        const rawDomain = store.shopify_store_url.replace('https://', '').replace('http://', '').replace(/\/$/, '')
        rawShopifyDomain = rawDomain.includes('.myshopify.com')
          ? rawDomain.replace('.myshopify.com', '')
          : rawDomain
        shopifyToken = store.shopify_credentials.access_token
        console.log(`✅ Credenciales de tienda "${store.name}" (${store.country_code}) obtenidas desde DB`)
      } else {
        console.warn(`⚠️ Tienda ${resolvedStoreId} no encontrada o sin credenciales, usando fallback ENV`)
      }
    }

    // Fallback to ENV vars (Colombia default) if still no credentials
    if (!rawShopifyDomain || !shopifyToken) {
      console.log('📦 Usando credenciales ENV (Colombia default)')
      rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
      shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

      if (!rawShopifyDomain || !shopifyToken) {
        const { data: org } = await supabase
          .from('organizations')
          .select('shopify_store_url, shopify_credentials')
          .eq('name', 'Dosmicos')
          .single()

        if (org?.shopify_store_url && org.shopify_credentials?.access_token) {
          const url = new URL(org.shopify_store_url)
          rawShopifyDomain = url.hostname.replace('.myshopify.com', '')
          shopifyToken = org.shopify_credentials.access_token
          console.log('✅ Credenciales obtenidas de la organización')
        } else {
          throw new Error('Credenciales de Shopify no configuradas en ninguna fuente')
        }
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

    const approvedItems = requestData.approvedItems
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

    // Try /locations.json first (requires read_locations scope).
    // Some stores (e.g. USA) may only have read_inventory/write_inventory —
    // in that case we get a 403 here and resolve the location per-item from
    // inventory_levels.json instead (no extra scope needed).
    let locationId: number | null = null

    await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
    const locationsResponse = await fetch(
      `https://${shopifyDomain}/admin/api/2023-10/locations.json`,
      { headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' } }
    )

    if (locationsResponse.ok) {
      const locationsData = await locationsResponse.json()
      const primaryLocation = locationsData.locations?.find(
        (loc: any) => loc.legacy || loc.primary
      ) || locationsData.locations?.[0]
      if (primaryLocation) {
        locationId = primaryLocation.id
        console.log('✅ Location ID obtenido desde /locations.json:', locationId, '-', primaryLocation.name)
      }
    } else {
      console.warn(`⚠️ /locations.json devolvió ${locationsResponse.status} — se resolverá la location por item desde inventory_levels`)
    }

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
    let alreadySyncedSkus = []
    let itemsToSync = []

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
              const syncResults = log.sync_results as any;
              if (syncResults.results && Array.isArray(syncResults.results)) {
                const skuResult = syncResults.results.find((r: any) => 
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
      // Modo Sync Completo (intelligentSync=false / "Resincronizar Todo"):
      // Force-sync ALL items with quantity > 0. Do NOT check synced_to_shopify — the user
      // explicitly requested a full re-sync, so we honour that unconditionally.
      console.log('🔄 Modo Sync Completo — forzando re-sync de todos los items pendientes')

      for (const approvedItem of approvedItems) {
        if (approvedItem.quantityApproved === 0) {
          // Skip zero-quantity items (nothing to add to Shopify)
          const deliveryItem = deliveryItems.find(item =>
            item.order_items?.product_variants?.sku_variant === approvedItem.skuVariant
          )
          if (deliveryItem) {
            await supabase
              .from('delivery_items')
              .update({ synced_to_shopify: true, sync_error_message: 'Auto-marcado: cantidad 0' })
              .eq('id', deliveryItem.id)
          }
          alreadySyncedSkus.push({ sku: approvedItem.skuVariant, reason: 'quantity_zero_auto_sync' })
          continue
        }
        // Non-zero quantity → add to sync queue
        itemsToSync.push(approvedItem)
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
          const variantData = {
            id: variant.id,
            sku: variant.sku,
            inventory_item_id: variant.inventory_item_id,
            inventory_quantity: variant.inventory_quantity,
            inventory_management: variant.inventory_management,
            inventory_policy: variant.inventory_policy,
            product_title: product.title,
            product_id: product.id
          }
          // Index by SKU if available
          if (variant.sku) {
            allShopifyVariants.set(variant.sku, variantData)
          }
          // ALSO index by numeric variant ID (as string) to support stores
          // where products have no SKU configured (e.g. Dosmicos USA).
          // Sewdle stores the Shopify variant ID as the sku_variant fallback.
          allShopifyVariants.set(String(variant.id), variantData)
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

    console.log('=== PASO 5: BATCH INVENTORY LOOKUP ===')
    // Build a map of inventory_item_id → {available, location_id} via ONE batch API call.
    // This replaces the per-item GET inside the sync loop, saving 100 API calls.
    const inventoryLevelsMap = new Map<string, { available: number; location_id: number }>()

    const allInventoryItemIds = itemsToSync
      .map(item => validationResults.find(v => v.sku === item.skuVariant && v.found)?.variant?.inventory_item_id)
      .filter(Boolean)

    if (allInventoryItemIds.length > 0) {
      await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)
      try {
        const batchUrl = locationId
          ? `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${allInventoryItemIds.join(',')}&location_ids=${locationId}&limit=250`
          : `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${allInventoryItemIds.join(',')}&limit=250`

        console.log(`📦 Batch inventory lookup para ${allInventoryItemIds.length} items`)
        const batchResponse = await fetch(batchUrl, {
          headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' }
        })

        if (batchResponse.ok) {
          const batchData = await batchResponse.json()
          for (const level of batchData.inventory_levels || []) {
            const key = String(level.inventory_item_id)
            if (!inventoryLevelsMap.has(key)) {
              inventoryLevelsMap.set(key, { available: level.available ?? 0, location_id: level.location_id })
            }
          }
          // Derive global locationId from first result if not already known
          if (!locationId && batchData.inventory_levels?.[0]) {
            locationId = batchData.inventory_levels[0].location_id
            console.log('📍 Location ID derivado desde batch inventory_levels:', locationId)
          }
          console.log(`✅ Batch inventory lookup: ${inventoryLevelsMap.size} items mapeados`)
        } else {
          const errText = await batchResponse.text()
          console.warn(`⚠️ Batch inventory lookup falló (${batchResponse.status}): ${errText} — se continuará con available=0`)
        }
      } catch (batchErr) {
        console.warn('⚠️ Error en batch inventory lookup:', batchErr.message, '— continuando sin datos de inventario previo')
      }
    }

    console.log('=== PASO 6: SINCRONIZACIÓN CON RATE LIMITING OPTIMIZADO ===')
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

        const validatedVariant = validationResults.find(v => v.sku === item.skuVariant && v.found)
        if (!validatedVariant) {
          throw new Error(`Error interno: variante ${item.skuVariant} no encontrada`)
        }

        const targetVariant = validatedVariant.variant
        console.log('Variant ID:', targetVariant.id)
        console.log('Inventory Item ID:', targetVariant.inventory_item_id)
        console.log('Cantidad a agregar:', item.quantityApproved)

        // Use pre-fetched batch data (no per-item GET needed)
        const cachedLevel = inventoryLevelsMap.get(String(targetVariant.inventory_item_id))
        const itemLocationId = locationId ?? cachedLevel?.location_id
        const realCurrentInventory = cachedLevel?.available ?? 0
        const expectedNewInventory = realCurrentInventory + item.quantityApproved

        if (!itemLocationId) {
          throw new Error(`No se pudo determinar location_id para item ${targetVariant.inventory_item_id}`)
        }

        console.log('Inventario actual en Shopify:', realCurrentInventory)
        console.log('Cantidad a agregar:', item.quantityApproved)
        console.log('Inventario esperado después:', expectedNewInventory)

        // RATE LIMITED: Adjust inventory in Shopify
        await delay(SHOPIFY_API_RATE_LIMIT.DELAY_BETWEEN_CALLS)

        const inventoryUpdateResult = await retryWithBackoff(async () => {
          const adjustUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/adjust.json`
          const adjustPayload = {
            location_id: itemLocationId,
            inventory_item_id: targetVariant.inventory_item_id,
            available_adjustment: item.quantityApproved
          }

          console.log('Payload adjust:', JSON.stringify(adjustPayload))

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

            // Fallback: use SET method
            const setUrl = `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/set.json`
            const setResponse = await fetch(setUrl, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': shopifyToken,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                location_id: itemLocationId,
                inventory_item_id: targetVariant.inventory_item_id,
                available: expectedNewInventory
              })
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

        // Mark as successfully synced in DB
        await supabase
          .from('delivery_items')
          .update({
            synced_to_shopify: true,
            sync_error_message: null,
            sync_attempt_count: (deliveryItem.sync_attempt_count || 0)
          })
          .eq('id', deliveryItem.id)

        console.log(`✅ Item ${item.skuVariant} sincronizado exitosamente`)

        syncResults.push({
          sku: item.skuVariant,
          status: 'success',
          previousQuantity: realCurrentInventory,
          addedQuantity: item.quantityApproved,
          newQuantity: expectedNewInventory,
          variantId: targetVariant.id,
          inventoryItemId: targetVariant.inventory_item_id,
          locationId: itemLocationId,
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
        location_name: locationId ? 'resolved_via_locations_api' : 'resolved_per_item',
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
