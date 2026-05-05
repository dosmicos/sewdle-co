import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import { corsHeaders } from '../_shared/cors.ts'

interface ResyncRequest {
  shipping_label_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shipping_label_id } = await req.json() as ResyncRequest;

    if (!shipping_label_id) {
      throw new Error('shipping_label_id es requerido');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the shipping label with its tracking info
    const { data: label, error: labelError } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', shipping_label_id)
      .single();

    if (labelError || !label) {
      throw new Error(`Shipping label not found: ${labelError?.message || 'No data'}`);
    }

    if (label.shopify_fulfillment_status === 'success') {
      return new Response(
        JSON.stringify({ success: true, message: 'Already fulfilled in Shopify', already_synced: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!label.tracking_number) {
      throw new Error('Shipping label has no tracking number');
    }

    console.log(`🔄 Resync fulfillment for order ${label.shopify_order_id}, tracking: ${label.tracking_number}`);

    // Get organization's Shopify credentials
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('shopify_store_url, shopify_credentials')
      .eq('id', label.organization_id)
      .single();

    if (orgError || !org?.shopify_store_url || !org?.shopify_credentials) {
      throw new Error('Shopify credentials not configured for this organization');
    }

    const credentials = org.shopify_credentials as { access_token?: string };
    const accessToken = credentials.access_token;
    if (!accessToken) {
      throw new Error('No Shopify access token found');
    }

    let shopDomain = org.shopify_store_url
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }

    // Map carrier names
    const carrierNamesMap: Record<string, string> = {
      'coordinadora': 'Coordinadora Mercantil',
      'interrapidisimo': 'Inter Rapidísimo',
      'deprisa': 'Deprisa',
      'servientrega': 'Servientrega',
      'tcc': 'TCC',
      'envia': 'Envia'
    };
    const trackingCompany = carrierNamesMap[label.carrier?.toLowerCase()] || label.carrier || 'Other';

    // Step 1: Get fulfillment orders
    console.log('📋 Fetching fulfillment orders...');
    const fulfillmentOrdersResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/orders/${label.shopify_order_id}/fulfillment_orders.json`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      }
    );

    const fulfillmentOrdersData = await fulfillmentOrdersResponse.json();
    if (!fulfillmentOrdersResponse.ok) {
      throw new Error(`Failed to get fulfillment orders: ${JSON.stringify(fulfillmentOrdersData.errors || fulfillmentOrdersData)}`);
    }

    const fulfillmentOrders = fulfillmentOrdersData.fulfillment_orders || [];
    const openFulfillmentOrder = fulfillmentOrders.find(
      (fo: any) => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      // Already fulfilled - update local status
      await supabase
        .from('shipping_labels')
        .update({
          shopify_fulfillment_status: 'success',
          shopify_fulfillment_error: null
        })
        .eq('id', shipping_label_id);

      return new Response(
        JSON.stringify({ success: true, message: 'Order already fulfilled in Shopify', already_synced: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Create fulfillment
    const fulfillmentPayload = {
      fulfillment: {
        line_items_by_fulfillment_order: [
          { fulfillment_order_id: openFulfillmentOrder.id }
        ],
        tracking_info: {
          company: trackingCompany,
          number: label.tracking_number,
          url: `https://envia.com/es-CO/tracking?label=${label.tracking_number}`
        },
        notify_customer: true
      }
    };

    console.log('📦 Creating fulfillment...');
    const fulfillmentResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-01/fulfillments.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fulfillmentPayload)
      }
    );

    const fulfillmentData = await fulfillmentResponse.json();

    if (fulfillmentResponse.ok && fulfillmentData.fulfillment?.id) {
      const fulfillmentId = String(fulfillmentData.fulfillment.id);
      console.log('✅ Fulfillment created:', fulfillmentId);

      // Update shipping_labels
      await supabase
        .from('shipping_labels')
        .update({
          shopify_fulfillment_id: fulfillmentId,
          shopify_fulfillment_status: 'success',
          shopify_fulfillment_error: null
        })
        .eq('id', shipping_label_id);

      // Update shopify_orders
      await supabase
        .from('shopify_orders')
        .update({ fulfillment_status: 'fulfilled' })
        .eq('shopify_order_id', label.shopify_order_id);

      return new Response(
        JSON.stringify({ success: true, fulfillment_id: fulfillmentId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorMsg = JSON.stringify(fulfillmentData.errors || fulfillmentData);
      console.error('❌ Fulfillment failed:', errorMsg);

      // Update shipping_labels with error
      await supabase
        .from('shipping_labels')
        .update({
          shopify_fulfillment_status: 'failed',
          shopify_fulfillment_error: errorMsg
        })
        .eq('id', shipping_label_id);

      throw new Error(`Shopify fulfillment failed: ${errorMsg}`);
    }
  } catch (error: any) {
    console.error('❌ resync-shopify-fulfillment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
