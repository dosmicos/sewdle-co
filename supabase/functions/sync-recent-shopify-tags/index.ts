import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShopifyOrder {
  id: number
  order_number: number
  tags: string
  note: string | null
  financial_status: string
  fulfillment_status: string | null
  cancelled_at: string | null
  updated_at: string
}

interface OrganizationCredentials {
  id: string
  name: string
  shopify_store_url: string
  shopify_credentials: {
    access_token: string
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('🔄 Iniciando sincronización automática de tags...')

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all organizations with Shopify configured
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, shopify_store_url, shopify_credentials')
      .not('shopify_store_url', 'is', null)
      .not('shopify_credentials', 'is', null)

    if (orgError) {
      console.error('❌ Error obteniendo organizaciones:', orgError)
      throw orgError
    }

    if (!organizations || organizations.length === 0) {
      console.log('⚠️ No hay organizaciones con Shopify configurado')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No organizations with Shopify configured',
        organizations_processed: 0,
        orders_updated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`📊 Procesando ${organizations.length} organizaciones...`)

    let totalOrdersUpdated = 0
    const results: { organization: string; orders_updated: number; error?: string }[] = []

    for (const org of organizations as OrganizationCredentials[]) {
      try {
        console.log(`\n🏪 Procesando: ${org.name}`)
        
        const accessToken = org.shopify_credentials?.access_token
        if (!accessToken) {
          console.log(`⚠️ ${org.name}: Sin access_token configurado`)
          results.push({ organization: org.name, orders_updated: 0, error: 'No access token' })
          continue
        }

        // Extract store domain from URL
        let storeDomain = org.shopify_store_url
        if (storeDomain.includes('://')) {
          storeDomain = storeDomain.split('://')[1]
        }
        storeDomain = storeDomain.replace(/\/$/, '')

        // Get orders updated in the last 5 minutes (with buffer for timing)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        
        const shopifyUrl = `https://${storeDomain}/admin/api/2024-01/orders.json?updated_at_min=${fiveMinutesAgo}&limit=100&status=any&fields=id,order_number,tags,note,financial_status,fulfillment_status,cancelled_at,updated_at`
        
        console.log(`📡 Consultando Shopify API: orders updated since ${fiveMinutesAgo}`)

        const shopifyResponse = await fetch(shopifyUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        })

        if (!shopifyResponse.ok) {
          const errorText = await shopifyResponse.text()
          console.error(`❌ ${org.name}: Error de Shopify API (${shopifyResponse.status}):`, errorText)
          results.push({ organization: org.name, orders_updated: 0, error: `Shopify API error: ${shopifyResponse.status}` })
          continue
        }

        const shopifyData = await shopifyResponse.json()
        const orders: ShopifyOrder[] = shopifyData.orders || []

        console.log(`📦 ${org.name}: ${orders.length} pedidos actualizados recientemente`)

        if (orders.length === 0) {
          results.push({ organization: org.name, orders_updated: 0 })
          continue
        }

        // Update each order's tags and status fields in the database
        let ordersUpdated = 0
        for (const order of orders) {
          const { error: updateError } = await supabase
            .from('shopify_orders')
            .update({
              tags: order.tags || null,
              note: order.note || null,
              financial_status: order.financial_status,
              fulfillment_status: order.fulfillment_status,
              cancelled_at: order.cancelled_at,
              updated_at_shopify: order.updated_at,
            })
            .eq('shopify_order_id', order.id)
            .eq('organization_id', org.id)

          if (updateError) {
            console.error(`⚠️ Error actualizando orden ${order.order_number}:`, updateError.message)
          } else {
            ordersUpdated++
            if (order.tags) {
              console.log(`✅ Orden ${order.order_number}: tags="${order.tags}"`)
            }
          }
        }

        totalOrdersUpdated += ordersUpdated
        results.push({ organization: org.name, orders_updated: ordersUpdated })
        console.log(`✅ ${org.name}: ${ordersUpdated} pedidos actualizados`)

      } catch (orgError) {
        console.error(`❌ Error procesando ${org.name}:`, orgError)
        results.push({ organization: org.name, orders_updated: 0, error: String(orgError) })
      }
    }

    // Log the sync execution
    const { error: logError } = await supabase
      .from('sync_control_logs')
      .insert({
        sync_type: 'tags_sync',
        sync_mode: 'scheduled',
        status: 'completed',
        start_time: new Date(startTime).toISOString(),
        end_time: new Date().toISOString(),
        orders_processed: totalOrdersUpdated,
        error_message: null,
      })

    if (logError) {
      console.error('⚠️ Error guardando log de sincronización:', logError)
    }

    const duration = Date.now() - startTime
    console.log(`\n🎉 Sincronización completada en ${duration}ms`)
    console.log(`📊 Total: ${totalOrdersUpdated} pedidos actualizados`)

    return new Response(JSON.stringify({
      success: true,
      duration_ms: duration,
      organizations_processed: organizations.length,
      orders_updated: totalOrdersUpdated,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Error en sincronización:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
