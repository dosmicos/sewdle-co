import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Dosmicos origin address (fixed)
const DOSMICOS_ORIGIN = {
  name: "Dosmicos",
  company: "Dosmicos SAS",
  email: "envios@dosmicos.com",
  phone: "3001234567",
  street: "Calle 85",
  number: "11-53",
  district: "Chicó Norte",
  city: "Bogotá",
  state: "Cundinamarca",
  country: "CO",
  postalCode: "110221"
};

// Default package dimensions
const DEFAULT_PACKAGE = {
  content: "Ropa infantil",
  amount: 1,
  type: "box",
  weight: 1,
  insurance: 0,
  declaredValue: 100000,
  weightUnit: "kg",
  lengthUnit: "cm",
  dimensions: {
    length: 30,
    width: 25,
    height: 10
  }
};

interface CreateLabelRequest {
  shopify_order_id: number;
  organization_id: string;
  order_number: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  destination_address: string;
  destination_city: string;
  destination_department: string;
  destination_postal_code?: string;
  package_content?: string;
  package_weight?: number;
  declared_value?: number;
  preferred_carrier?: string;
}

serve(async (req) => {
  // Handle CORS preflight
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
    const body: CreateLabelRequest = await req.json();

    console.log('📦 Creating label for order:', body.order_number);

    // Check if label already exists
    const { data: existingLabel } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('shopify_order_id', body.shopify_order_id)
      .eq('organization_id', body.organization_id)
      .maybeSingle();

    if (existingLabel) {
      console.log('⚠️ Label already exists for this order');
      return new Response(
        JSON.stringify({ 
          success: true, 
          label: existingLabel,
          tracking_number: existingLabel.tracking_number,
          label_url: existingLabel.label_url,
          carrier: existingLabel.carrier,
          message: 'Label already exists'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up coverage for the destination city
    const normalizedCity = body.destination_city.trim().toUpperCase();
    const normalizedDept = body.destination_department.trim().toUpperCase();

    console.log(`🔍 Checking coverage for: ${normalizedCity}, ${normalizedDept}`);

    const { data: coverage, error: coverageError } = await supabase
      .from('shipping_coverage')
      .select('*')
      .eq('organization_id', body.organization_id)
      .ilike('municipality', `%${normalizedCity}%`)
      .maybeSingle();

    // Determine carrier
    let selectedCarrier = body.preferred_carrier;
    let postalCode = body.destination_postal_code || '';

    if (coverage) {
      console.log('✅ Coverage found:', coverage);
      postalCode = postalCode || coverage.postal_code || '';
      
      // Select carrier based on coverage and priority
      if (!selectedCarrier) {
        if (coverage.priority_carrier) {
          selectedCarrier = coverage.priority_carrier;
        } else if (coverage.coordinadora) {
          selectedCarrier = 'coordinadora';
        } else if (coverage.interrapidisimo) {
          selectedCarrier = 'interrapidisimo';
        } else if (coverage.deprisa) {
          selectedCarrier = 'deprisa';
        }
      }
    } else {
      console.log('⚠️ No coverage found, using default carrier');
    }

    // Default to coordinadora if no carrier selected
    selectedCarrier = selectedCarrier || 'coordinadora';
    console.log(`🚚 Selected carrier: ${selectedCarrier}`);

    // Build Envia.com request
    const enviaRequest = {
      origin: DOSMICOS_ORIGIN,
      destination: {
        name: body.recipient_name,
        company: "",
        email: body.recipient_email || "cliente@dosmicos.com",
        phone: body.recipient_phone || "3000000000",
        street: body.destination_address,
        number: "N/A",
        district: body.destination_city,
        city: body.destination_city,
        state: body.destination_department,
        country: "CO",
        postalCode: postalCode || "000000",
        reference: `Pedido ${body.order_number}`
      },
      packages: [{
        ...DEFAULT_PACKAGE,
        content: body.package_content || `Pedido ${body.order_number}`,
        weight: body.package_weight || DEFAULT_PACKAGE.weight,
        declaredValue: body.declared_value || DEFAULT_PACKAGE.declaredValue
      }],
      shipment: {
        carrier: selectedCarrier,
        service: "express",
        type: 1 // 1 = normal shipment
      },
      settings: {
        printFormat: "PDF",
        printSize: "STOCK_4X6",
        currency: "COP"
      }
    };

    console.log('📤 Sending request to Envia.com API...');

    // Call Envia.com API
    const enviaResponse = await fetch('https://api.envia.com/ship/generate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENVIA_API_KEY}`
      },
      body: JSON.stringify(enviaRequest)
    });

    const enviaData = await enviaResponse.json();
    console.log('📥 Envia.com response:', JSON.stringify(enviaData, null, 2));

    if (!enviaResponse.ok || enviaData.meta === 'error') {
      const errorMsg = enviaData.error?.message || enviaData.message || 'Error en API de Envia.com';
      console.error('❌ Envia.com API error:', errorMsg);
      
      // Save failed attempt
      await supabase
        .from('shipping_labels')
        .insert({
          organization_id: body.organization_id,
          shopify_order_id: body.shopify_order_id,
          order_number: body.order_number,
          carrier: selectedCarrier,
          status: 'error',
          destination_city: body.destination_city,
          destination_department: body.destination_department,
          destination_address: body.destination_address,
          recipient_name: body.recipient_name,
          recipient_phone: body.recipient_phone,
          raw_response: enviaData
        });

      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Extract label data from response
    const shipmentData = enviaData.data?.[0];
    if (!shipmentData) {
      console.error('❌ No shipment data in response');
      return new Response(
        JSON.stringify({ success: false, error: 'No se recibieron datos de la guía' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Save successful label
    const labelRecord = {
      organization_id: body.organization_id,
      shopify_order_id: body.shopify_order_id,
      order_number: body.order_number,
      carrier: shipmentData.carrier || selectedCarrier,
      tracking_number: shipmentData.trackingNumber,
      label_url: shipmentData.label,
      shipment_id: shipmentData.shipmentId?.toString(),
      total_price: shipmentData.totalPrice,
      status: 'created',
      destination_city: body.destination_city,
      destination_department: body.destination_department,
      destination_address: body.destination_address,
      recipient_name: body.recipient_name,
      recipient_phone: body.recipient_phone,
      raw_response: enviaData
    };

    const { data: savedLabel, error: saveError } = await supabase
      .from('shipping_labels')
      .insert(labelRecord)
      .select()
      .single();

    if (saveError) {
      console.error('❌ Error saving label:', saveError);
      // Still return success since label was created in Envia
    }

    console.log('✅ Label created successfully:', shipmentData.trackingNumber);

    return new Response(
      JSON.stringify({
        success: true,
        label: savedLabel || labelRecord,
        tracking_number: shipmentData.trackingNumber,
        label_url: shipmentData.label,
        carrier: shipmentData.carrier || selectedCarrier
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in create-envia-label:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
