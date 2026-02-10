import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface TrackRequest {
  tracking_number: string;
  carrier: string;
}

interface TrackingEvent {
  date: string;
  time: string;
  description: string;
  location: string;
  status: string;
}

interface TrackingResponse {
  success: boolean;
  tracking_number: string;
  carrier: string;
  status: string;
  origin?: string;
  destination?: string;
  last_update?: string;
  estimated_delivery?: string;
  events: TrackingEvent[];
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENVIA_API_KEY = Deno.env.get('ENVIA_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!ENVIA_API_KEY) {
      console.error('❌ ENVIA_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key de Envia.com no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: TrackRequest = await req.json();

    console.log('📍 Tracking shipment:', body.tracking_number, 'carrier:', body.carrier);

    if (!body.tracking_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere número de rastreo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build tracking request following Envia.com API docs
    const trackRequest = {
      trackingNumbers: [body.tracking_number],
      carrier: body.carrier || undefined
    };

    console.log('📤 Sending tracking request to Envia.com API...');
    console.log('📤 Request payload:', JSON.stringify(trackRequest, null, 2));

    // Call Envia.com Tracking API
    const enviaResponse = await fetch('https://api.envia.com/ship/generaltrack/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENVIA_API_KEY}`
      },
      body: JSON.stringify(trackRequest)
    });

    const enviaData = await enviaResponse.json();
    console.log('📥 Envia.com tracking response status:', enviaResponse.status);
    console.log('📥 Envia.com tracking response:', JSON.stringify(enviaData, null, 2));

    if (!enviaResponse.ok || enviaData.meta === 'error') {
      const errorMsg = enviaData?.error?.message || enviaData?.message || 'Error al rastrear envío';
      console.error('❌ Envia.com tracking error:', errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: enviaData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse tracking data from response
    const trackingData = enviaData.data?.[0];
    
    if (!trackingData) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No se encontró información de rastreo para este número' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Parse events
    const events: TrackingEvent[] = [];
    if (trackingData.checkpoints && Array.isArray(trackingData.checkpoints)) {
      for (const checkpoint of trackingData.checkpoints) {
        events.push({
          date: checkpoint.date || '',
          time: checkpoint.time || '',
          description: checkpoint.description || checkpoint.message || '',
          location: checkpoint.location || checkpoint.city || '',
          status: checkpoint.status || ''
        });
      }
    }

    // Determine overall status
    let status = 'in_transit';
    const lastEvent = events[0];
    if (lastEvent) {
      const statusLower = lastEvent.status?.toLowerCase() || lastEvent.description?.toLowerCase() || '';
      if (statusLower.includes('entregado') || statusLower.includes('delivered')) {
        status = 'delivered';
      } else if (statusLower.includes('devuelto') || statusLower.includes('returned')) {
        status = 'returned';
      } else if (statusLower.includes('problema') || statusLower.includes('exception')) {
        status = 'exception';
      } else if (statusLower.includes('pendiente') || statusLower.includes('pending')) {
        status = 'pending';
      }
    }

    const response: TrackingResponse = {
      success: true,
      tracking_number: body.tracking_number,
      carrier: trackingData.carrier || body.carrier || 'unknown',
      status: status,
      origin: trackingData.origin || null,
      destination: trackingData.destination || null,
      last_update: trackingData.lastUpdate || null,
      estimated_delivery: trackingData.estimatedDelivery || null,
      events: events
    };

    // Update shipping_labels table with latest tracking status
    const { error: updateError } = await supabase
      .from('shipping_labels')
      .update({
        status: status,
        last_tracking_update: new Date().toISOString(),
        tracking_events: events
      })
      .eq('tracking_number', body.tracking_number);

    if (updateError) {
      console.log('⚠️ Could not update shipping_labels:', updateError.message);
    }

    // Sync UGC campaign status when shipment is delivered
    if (status === 'delivered') {
      console.log('📦 Shipment delivered, checking for linked UGC campaigns...');
      
      const { data: label } = await supabase
        .from('shipping_labels')
        .select('order_number, organization_id')
        .eq('tracking_number', body.tracking_number)
        .maybeSingle();

      if (label?.order_number && label?.organization_id) {
        const normalizedOrder = label.order_number.replace('#', '');
        console.log(`🔗 Found order ${normalizedOrder}, updating UGC campaigns...`);

        const { data: updated, error: ugcError } = await supabase
          .from('ugc_campaigns')
          .update({ status: 'producto_recibido', updated_at: new Date().toISOString() })
          .eq('organization_id', label.organization_id)
          .eq('status', 'producto_enviado')
          .or(`order_number.eq.${normalizedOrder},order_number.eq.#${normalizedOrder}`)
          .select('id');

        if (ugcError) {
          console.log('⚠️ Could not update UGC campaigns:', ugcError.message);
        } else if (updated && updated.length > 0) {
          console.log(`✅ Updated ${updated.length} UGC campaign(s) to producto_recibido`);
        }
      }
    }

    console.log(`✅ Tracking info retrieved: ${status}, ${events.length} events`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in envia-track:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
