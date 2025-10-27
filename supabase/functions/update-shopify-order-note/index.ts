import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { shopifyOrderId, note } = await req.json()

    if (!shopifyOrderId) {
      return new Response(
        JSON.stringify({ error: 'shopifyOrderId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Primero intentar obtener de variables de entorno
    let rawShopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    let shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    // Variables para obtener organización si es necesario
    let organizationId = null

    // Si no hay credenciales en env, obtenerlas de la base de datos
    if (!rawShopifyDomain || !shopifyToken) {
      console.log('🔍 Obteniendo credenciales desde la base de datos...')
      
      const { data: orderData, error: orderError } = await supabaseClient
        .from('shopify_orders')
        .select('organization_id, organizations(shopify_store_url, shopify_credentials)')
        .eq('shopify_order_id', shopifyOrderId)
        .single()

      if (orderError || !orderData) {
        console.error('❌ Error fetching order:', orderError)
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { organizations } = orderData as any
      organizationId = orderData.organization_id
      
      if (organizations.shopify_store_url && organizations.shopify_credentials?.access_token) {
        const url = new URL(organizations.shopify_store_url)
        rawShopifyDomain = url.hostname.replace('.myshopify.com', '')
        shopifyToken = organizations.shopify_credentials.access_token
        console.log('✅ Credenciales obtenidas de la organización')
      }
    } else {
      console.log('✅ Usando credenciales de variables de entorno')
      
      // Aún necesitamos obtener el organization_id para verificar la orden
      const { data: orderData, error: orderError } = await supabaseClient
        .from('shopify_orders')
        .select('organization_id')
        .eq('shopify_order_id', shopifyOrderId)
        .single()

      if (orderError || !orderData) {
        console.error('❌ Error fetching order:', orderError)
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      organizationId = orderData.organization_id
    }

    // Normalizar el dominio de Shopify
    const shopifyDomain = rawShopifyDomain?.includes('.myshopify.com') 
      ? rawShopifyDomain
      : rawShopifyDomain + '.myshopify.com'
    const accessToken = shopifyToken

    if (!shopifyDomain || !accessToken) {
      console.error('❌ Missing Shopify credentials')
      return new Response(
        JSON.stringify({ error: 'Shopify credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📝 Updating note for order ${shopifyOrderId}`)
    console.log('Domain:', shopifyDomain)
    console.log('Token present:', accessToken ? 'Yes' : 'No')

    console.log(`📝 Updating note for order ${shopifyOrderId} in Shopify...`)

    // Update order note in Shopify
    const shopifyUrl = `https://${shopifyDomain}/admin/api/2024-01/orders/${shopifyOrderId}.json`
    const shopifyResponse = await fetch(shopifyUrl, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order: {
          id: shopifyOrderId,
          note: note || null
        }
      })
    })

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text()
      console.error('❌ Shopify API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to update note in Shopify', details: errorText }),
        { status: shopifyResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updatedOrder = await shopifyResponse.json()
    console.log('✅ Note updated in Shopify successfully')

    // Update note in local database
    const { error: updateError } = await supabaseClient
      .from('shopify_orders')
      .update({ 
        note: note || null,
        raw_data: updatedOrder.order
      })
      .eq('shopify_order_id', shopifyOrderId)

    if (updateError) {
      console.error('⚠️ Error updating local database:', updateError)
      // No lanzamos error ya que la nota se actualizó en Shopify
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Note updated successfully',
        note: note 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error updating order note:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
