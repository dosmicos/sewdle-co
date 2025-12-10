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
          cancel_response: cancelResult
        }
      })
      .eq('id', label_id);

    if (updateError) {
      console.error('Error updating label status:', updateError);
      throw new Error(`Failed to update label: ${updateError.message}`);
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
