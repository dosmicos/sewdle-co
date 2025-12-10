import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Colombia department to state code mapping according to Envia.com API documentation
// Reference: https://docs.envia.com/#004e17f0-dc66-48bc-918a-919daeec68f2
const COLOMBIA_STATE_CODES: Record<string, string> = {
  // Amazonas
  'amazonas': 'AM',
  // Antioquia
  'antioquia': 'AN',
  // Arauca
  'arauca': 'AR',
  // Atlántico
  'atlantico': 'AT', 'atlántico': 'AT',
  // Bogotá D.C.
  'bogota': 'DC', 'bogotá': 'DC', 'bogota dc': 'DC', 'bogotá dc': 'DC', 
  'bogota d.c.': 'DC', 'bogotá d.c.': 'DC', 'bogota, d.c.': 'DC', 'bogotá, d.c.': 'DC',
  'distrito capital': 'DC', 'capital district': 'DC',
  // Bolívar
  'bolivar': 'BL', 'bolívar': 'BL',
  // Boyacá
  'boyaca': 'BY', 'boyacá': 'BY',
  // Caldas
  'caldas': 'CL',
  // Caquetá - CORREGIDO: CA (no CQ)
  'caqueta': 'CA', 'caquetá': 'CA',
  // Casanare
  'casanare': 'CS',
  // Cauca - CORREGIDO: CU (no CA)
  'cauca': 'CU',
  // Cesar
  'cesar': 'CE',
  // Chocó
  'choco': 'CH', 'chocó': 'CH',
  // Córdoba
  'cordoba': 'CO', 'córdoba': 'CO',
  // Cundinamarca - CORREGIDO: CN (no CU)
  'cundinamarca': 'CN',
  // Guainía - CORREGIDO: GU (no GN)
  'guainia': 'GU', 'guainía': 'GU',
  // Guaviare - CORREGIDO: GA (no GV)
  'guaviare': 'GA',
  // Huila
  'huila': 'HU',
  // La Guajira
  'la guajira': 'LG', 'guajira': 'LG',
  // Magdalena - CORREGIDO: MA (no MG)
  'magdalena': 'MA',
  // Meta - CORREGIDO: ME (no MT)
  'meta': 'ME',
  // Nariño
  'narino': 'NA', 'nariño': 'NA',
  // Norte de Santander
  'norte de santander': 'NS',
  // Putumayo
  'putumayo': 'PU',
  // Quindío - CORREGIDO: QU (no QD)
  'quindio': 'QU', 'quindío': 'QU',
  // Risaralda
  'risaralda': 'RI',
  // San Andrés y Providencia
  'san andres': 'SA', 'san andres y providencia': 'SA', 'san andrés': 'SA', 'san andrés y providencia': 'SA',
  // Santander - CORREGIDO: SN (no ST)
  'santander': 'SN',
  // Sucre
  'sucre': 'SU',
  // Tolima
  'tolima': 'TO',
  // Valle del Cauca
  'valle del cauca': 'VC', 'valle': 'VC',
  // Vaupés - CORREGIDO: VA (no VP)
  'vaupes': 'VA', 'vaupés': 'VA',
  // Vichada
  'vichada': 'VI'
};

// Get state code from department name
function getStateCode(department: string): string {
  const normalized = department.toLowerCase().trim();
  return COLOMBIA_STATE_CODES[normalized] || 'DC'; // Default to Bogota if unknown
}

// Dosmicos origin address (fixed) - Updated with correct data
const DOSMICOS_ORIGIN = {
  name: "Julian Castro",
  company: "Dosmicos SAS",
  email: "dosmicoscol@gmail.com",
  phone: "3125456340",
  street: "Cra 27",
  number: "63b-61",
  district: "Quinta de Mutis",
  city: "Bogota",
  state: "DC",
  country: "CO",
  postalCode: "111321",
  reference: "CASA 1er piso de rejas negras"
};

// Default package dimensions
const DEFAULT_PACKAGE = {
  content: "Ropa infantil",
  amount: 1,
  type: "box",
  weight: 1,
  insurance: 0,
  declaredValue: 100000,
  weightUnit: "KG",
  lengthUnit: "CM",
  dimensions: {
    length: 30,
    width: 25,
    height: 10
  }
};

// Available carriers for Colombia
const COLOMBIA_CARRIERS: Record<string, { carrier: string; service: string }> = {
  'coordinadora': { carrier: 'coordinadora', service: 'ground' },
  'interrapidisimo': { carrier: 'interrapidisimo', service: 'ground' },
  'servientrega': { carrier: 'servientrega', service: 'ground' },
  'deprisa': { carrier: 'deprisa', service: 'ground' },
  'envia': { carrier: 'envia', service: 'ground' },
  'tcc': { carrier: 'tcc', service: 'ground' }
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
    console.log('📍 Destination:', body.destination_city, body.destination_department);

    // Validate required fields
    if (!body.destination_address || !body.destination_city) {
      console.error('❌ Missing required address fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Dirección incompleta: se requiere dirección y ciudad' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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

    const { data: coverage } = await supabase
      .from('shipping_coverage')
      .select('*')
      .eq('organization_id', body.organization_id)
      .ilike('municipality', `%${normalizedCity}%`)
      .maybeSingle();

    // Determine carrier
    let selectedCarrier = body.preferred_carrier?.toLowerCase();
    let postalCode = body.destination_postal_code || '';

    if (coverage) {
      console.log('✅ Coverage found:', coverage);
      postalCode = postalCode || coverage.postal_code || '';
      
      // Select carrier based on coverage and priority
      if (!selectedCarrier) {
        if (coverage.priority_carrier) {
          selectedCarrier = coverage.priority_carrier.toLowerCase();
        } else if (coverage.coordinadora) {
          selectedCarrier = 'coordinadora';
        } else if (coverage.interrapidisimo) {
          selectedCarrier = 'interrapidisimo';
        } else if (coverage.servientrega) {
          selectedCarrier = 'servientrega';
        } else if (coverage.deprisa) {
          selectedCarrier = 'deprisa';
        }
      }
    } else {
      console.log('⚠️ No coverage found, using default carrier (coordinadora)');
    }

    // Default to coordinadora if no carrier selected
    selectedCarrier = selectedCarrier || 'coordinadora';
    const carrierConfig = COLOMBIA_CARRIERS[selectedCarrier] || COLOMBIA_CARRIERS['coordinadora'];
    
    console.log(`🚚 Selected carrier: ${carrierConfig.carrier}, service: ${carrierConfig.service}`);

    // Get state code for the destination department
    const stateCode = getStateCode(body.destination_department);
    console.log(`📍 Department "${body.destination_department}" -> State code "${stateCode}"`);

    // Parse address to separate street and number if possible
    const addressParts = body.destination_address.split(/[,#]/);
    const street = addressParts[0]?.trim() || body.destination_address;
    const number = addressParts[1]?.trim() || "S/N";

    // Clean phone number (remove non-numeric characters except +)
    const cleanPhone = (body.recipient_phone || "3000000000").replace(/[^0-9+]/g, '');

    // Build Envia.com request following their exact format
    const enviaRequest = {
      origin: DOSMICOS_ORIGIN,
      destination: {
        name: body.recipient_name || "Cliente",
        company: "",
        email: body.recipient_email || "cliente@dosmicos.com",
        phone: cleanPhone,
        street: street,
        number: number,
        district: body.destination_city,
        city: body.destination_city,
        state: stateCode,
        country: "CO",
        postalCode: postalCode || "000000",
        reference: `Pedido #${body.order_number}`
      },
      packages: [{
        content: body.package_content || `Ropa - Pedido ${body.order_number}`,
        amount: 1,
        type: "box",
        weight: body.package_weight || DEFAULT_PACKAGE.weight,
        insurance: 0,
        declaredValue: body.declared_value || DEFAULT_PACKAGE.declaredValue,
        weightUnit: "KG",
        lengthUnit: "CM",
        dimensions: DEFAULT_PACKAGE.dimensions
      }],
      shipment: {
        carrier: carrierConfig.carrier,
        service: carrierConfig.service,
        type: 1
      },
      settings: {
        printFormat: "PDF",
        printSize: "STOCK_4X6",
        currency: "COP",
        comments: `Pedido Dosmicos #${body.order_number}`
      }
    };

    console.log('📤 Sending request to Envia.com API...');
    console.log('📤 Request payload:', JSON.stringify(enviaRequest, null, 2));

    // Call Envia.com API - Production URL
    const enviaResponse = await fetch('https://api.envia.com/ship/generate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENVIA_API_KEY}`
      },
      body: JSON.stringify(enviaRequest)
    });

    const enviaData = await enviaResponse.json();
    console.log('📥 Envia.com response status:', enviaResponse.status);
    console.log('📥 Envia.com response:', JSON.stringify(enviaData, null, 2));

    // Handle different error scenarios
    if (!enviaResponse.ok) {
      let errorMsg = 'Error en API de Envia.com';
      
      if (enviaResponse.status === 401) {
        errorMsg = 'Token de API inválido o expirado';
      } else if (enviaResponse.status === 400) {
        errorMsg = enviaData?.error?.message || enviaData?.message || 'Datos de envío inválidos';
        
        // Extract more specific error info if available
        if (enviaData?.errors) {
          const errorDetails = Object.entries(enviaData.errors)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join('; ');
          errorMsg = `Error de validación: ${errorDetails}`;
        }
      } else if (enviaResponse.status === 500) {
        errorMsg = 'Error interno en servidor de Envia.com - intente más tarde';
      }
      
      console.error('❌ Envia.com API error:', errorMsg);
      
      // Save failed attempt
      await supabase
        .from('shipping_labels')
        .insert({
          organization_id: body.organization_id,
          shopify_order_id: body.shopify_order_id,
          order_number: body.order_number,
          carrier: carrierConfig.carrier,
          status: 'error',
          destination_city: body.destination_city,
          destination_department: body.destination_department,
          destination_address: body.destination_address,
          recipient_name: body.recipient_name,
          recipient_phone: body.recipient_phone,
          raw_response: enviaData
        });

      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: enviaData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check for API-level errors in successful HTTP response
    if (enviaData.meta === 'error' || enviaData.error) {
      const errorMsg = enviaData.error?.message || enviaData.message || 'Error al generar guía';
      console.error('❌ Envia.com returned error:', errorMsg);
      
      await supabase
        .from('shipping_labels')
        .insert({
          organization_id: body.organization_id,
          shopify_order_id: body.shopify_order_id,
          order_number: body.order_number,
          carrier: carrierConfig.carrier,
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
      carrier: shipmentData.carrier || carrierConfig.carrier,
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
        carrier: shipmentData.carrier || carrierConfig.carrier
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
