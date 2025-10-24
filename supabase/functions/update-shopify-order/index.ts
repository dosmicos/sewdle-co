import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { orderId, action, data } = await req.json()
    
    console.log(`🔄 Update Shopify Order - Action: ${action}, Order ID: ${orderId}`)

    if (!orderId || !action) {
      throw new Error('Missing required parameters: orderId and action')
    }

    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyAccessToken) {
      throw new Error('Shopify credentials not configured')
    }

    const shopifyApiUrl = `https://${shopifyDomain}/admin/api/2024-01/orders/${orderId}`

    let updatePayload: any = {}
    let response: Response

    switch (action) {
      case 'update_tags':
        console.log(`🏷️ Updating tags: ${data.tags?.join(', ')}`)
        updatePayload = {
          order: {
            tags: data.tags?.join(', ') || ''
          }
        }
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        })
        break

      case 'update_notes':
        console.log(`📝 Updating notes`)
        updatePayload = {
          order: {
            note: data.notes || ''
          }
        }
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        })
        break

      case 'create_fulfillment':
        console.log(`📦 Creating fulfillment`)
        const fulfillmentPayload = {
          fulfillment: {
            location_id: data.locationId,
            tracking_number: data.trackingNumber || null,
            notify_customer: data.notifyCustomer || false,
          }
        }
        response = await fetch(`${shopifyApiUrl}/fulfillments.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fulfillmentPayload)
        })
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Shopify API Error: ${errorText}`)
      throw new Error(`Shopify API error: ${errorText}`)
    }

    const result = await response.json()
    console.log(`✅ Shopify order updated successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Order ${action} completed`,
        data: result 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error updating Shopify order:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})