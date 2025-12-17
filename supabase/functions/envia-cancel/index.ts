import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENVIA_API_KEY = Deno.env.get('ENVIA_API_KEY');
    if (!ENVIA_API_KEY) {
      throw new Error('ENVIA_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { label_id } = await req.json();

    if (!label_id) {
      throw new Error('label_id is required');
    }

    console.log(`Cancelling label: ${label_id}`);

    // Get the label from database
    const { data: label, error: labelError } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('id', label_id)
      .single();

    if (labelError || !label) {
      throw new Error(`Label not found: ${labelError?.message || 'Not found'}`);
    }

    // Check if label can be cancelled
    if (label.status === 'cancelled') {
      throw new Error('Label is already cancelled');
    }

    if (label.status === 'manual') {
      throw new Error('Manual labels cannot be cancelled through Envia API');
    }

    if (!label.tracking_number) {
      throw new Error('Label has no tracking number');
    }

    console.log(`Calling Envia.com cancel API for carrier: ${label.carrier}, tracking: ${label.tracking_number}`);

    // Call Envia.com cancel endpoint
    const cancelResponse = await fetch('https://api.envia.com/ship/cancel/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENVIA_API_KEY}`
      },
      body: JSON.stringify({
        carrier: label.carrier,
        trackingNumber: label.tracking_number,
        folio: ''
      })
    });

    const cancelResult = await cancelResponse.json();
    console.log('Envia.com cancel response:', JSON.stringify(cancelResult));

    // Check if cancellation was successful
    const isSuccess = cancelResponse.ok || 
      (cancelResult.data && cancelResult.data.length > 0) ||
      cancelResult.meta === 'success';

    if (!isSuccess && cancelResult.error) {
      throw new Error(`Envia.com error: ${cancelResult.error}`);
    }

    // Update label status in database
    const { error: updateError } = await supabase
      .from('shipping_labels')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        raw_response: {
          ...((label.raw_response as object) || {}),
          cancel_response: cancelResult,
          cancelled_at: new Date().toISOString()
        }
      })
      .eq('id', label_id);

    if (updateError) {
      console.error('Error updating label status:', updateError);
      throw new Error(`Failed to update label: ${updateError.message}`);
    }

    // Cancel Shopify fulfillment if exists
    const shopifyOrderId = label.shopify_order_id;
    const organizationId = label.organization_id;
    
    if (shopifyOrderId && organizationId) {
      console.log(`Cancelling Shopify fulfillment for order ${shopifyOrderId}`);
      
      try {
        // Get organization's Shopify credentials
        const { data: org } = await supabase
          .from('organizations')
          .select('shopify_store_url, shopify_credentials')
          .eq('id', organizationId)
          .single();

        if (org?.shopify_store_url && org?.shopify_credentials) {
          const credentials = org.shopify_credentials as { access_token?: string };
          const accessToken = credentials.access_token;
          
          if (accessToken) {
            // Normalize domain
            let shopDomain = org.shopify_store_url
              .replace('https://', '')
              .replace('http://', '')
              .replace(/\/$/, '');
            
            if (!shopDomain.includes('.myshopify.com')) {
              shopDomain = `${shopDomain}.myshopify.com`;
            }

            // Get existing fulfillments for this order
            const fulfillmentsUrl = `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillments.json`;
            const fulfillmentsResponse = await fetch(fulfillmentsUrl, {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              }
            });

            if (fulfillmentsResponse.ok) {
              const fulfillmentsData = await fulfillmentsResponse.json();
              const fulfillments = fulfillmentsData.fulfillments || [];
              
              // Cancel each fulfillment
              for (const fulfillment of fulfillments) {
                if (fulfillment.status !== 'cancelled') {
                  console.log(`Cancelling fulfillment ${fulfillment.id}`);
                  
                  const cancelFulfillmentUrl = `https://${shopDomain}/admin/api/2024-01/orders/${shopifyOrderId}/fulfillments/${fulfillment.id}/cancel.json`;
                  const cancelFulfillmentResponse = await fetch(cancelFulfillmentUrl, {
                    method: 'POST',
                    headers: {
                      'X-Shopify-Access-Token': accessToken,
                      'Content-Type': 'application/json'
                    }
                  });

                  if (cancelFulfillmentResponse.ok) {
                    console.log(`Fulfillment ${fulfillment.id} cancelled successfully`);
                  } else {
                    const errorText = await cancelFulfillmentResponse.text();
                    console.error(`Failed to cancel fulfillment ${fulfillment.id}:`, errorText);
                  }
                }
              }
            }
          }
        }

        // Get current order state to determine correct status to restore
        const { data: currentOrder } = await supabase
          .from('picking_packing_orders')
          .select('packed_at, packed_by, operational_status')
          .eq('shopify_order_id', shopifyOrderId)
          .eq('organization_id', organizationId)
          .single();

        // Determine correct status based on whether order was actually packed:
        // - If packed_at exists → 'ready_to_ship' (was packed before shipping)
        // - If packed_at is null → 'pending' (was never properly packed)
        const newStatus = currentOrder?.packed_at ? 'ready_to_ship' : 'pending';
        
        console.log(`Restoring order ${shopifyOrderId} to status: ${newStatus} (packed_at: ${currentOrder?.packed_at})`);

        // Update local database status
        await supabase
          .from('picking_packing_orders')
          .update({
            operational_status: newStatus,
            shipped_at: null,
            shipped_by: null,
            updated_at: new Date().toISOString()
          })
          .eq('shopify_order_id', shopifyOrderId)
          .eq('organization_id', organizationId);

        // Update shopify_orders fulfillment status
        await supabase
          .from('shopify_orders')
          .update({
            fulfillment_status: null // unfulfilled
          })
          .eq('shopify_order_id', shopifyOrderId)
          .eq('organization_id', organizationId);

        console.log('Local database status updated to ready_to_ship');

      } catch (shopifyError) {
        console.error('Error cancelling Shopify fulfillment:', shopifyError);
        // Don't fail the whole operation if Shopify cancellation fails
      }
    }

    // Extract balance info if available
    const balanceReturned = cancelResult.data?.[0]?.balanceReturned || false;

    console.log(`Label ${label_id} cancelled successfully. Balance returned: ${balanceReturned}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Label cancelled successfully',
        balanceReturned,
        data: cancelResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error cancelling label:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cancel label'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
