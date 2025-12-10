import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Shopify province codes to Envia.com state codes
const SHOPIFY_TO_ENVIA_CODES: Record<string, string> = {
  'AMA': 'AM', 'ANT': 'AN', 'ARA': 'AR', 'ATL': 'AT', 'BOG': 'DC', 'DC': 'DC',
  'BOL': 'BL', 'BOY': 'BY', 'CAL': 'CL', 'CAQ': 'CA', 'CAS': 'CS', 'CAU': 'CU',
  'CES': 'CE', 'CHO': 'CH', 'COR': 'CO', 'CUN': 'CN', 'GUA': 'GU', 'GUV': 'GA',
  'HUI': 'HU', 'LAG': 'LG', 'MAG': 'MA', 'MET': 'ME', 'NAR': 'NA', 'NSA': 'NS',
  'PUT': 'PU', 'QUI': 'QU', 'RIS': 'RI', 'SAP': 'SA', 'SAN': 'SN', 'SUC': 'SU',
  'TOL': 'TO', 'VAC': 'VC', 'VAU': 'VA', 'VID': 'VI'
};

// Colombia department names to state codes
const COLOMBIA_STATE_CODES: Record<string, string> = {
  'amazonas': 'AM', 'antioquia': 'AN', 'arauca': 'AR',
  'atlantico': 'AT', 'atlántico': 'AT',
  'bogota': 'DC', 'bogotá': 'DC', 'bogota dc': 'DC', 'bogotá dc': 'DC',
  'bogota d.c.': 'DC', 'bogotá d.c.': 'DC', 'distrito capital': 'DC',
  'bolivar': 'BL', 'bolívar': 'BL', 'boyaca': 'BY', 'boyacá': 'BY',
  'caldas': 'CL', 'caqueta': 'CA', 'caquetá': 'CA', 'casanare': 'CS',
  'cauca': 'CU', 'cesar': 'CE', 'choco': 'CH', 'chocó': 'CH',
  'cordoba': 'CO', 'córdoba': 'CO', 'cundinamarca': 'CN',
  'guainia': 'GU', 'guainía': 'GU', 'guaviare': 'GA', 'huila': 'HU',
  'la guajira': 'LG', 'guajira': 'LG', 'magdalena': 'MA', 'meta': 'ME',
  'narino': 'NA', 'nariño': 'NA', 'norte de santander': 'NS',
  'putumayo': 'PU', 'quindio': 'QU', 'quindío': 'QU', 'risaralda': 'RI',
  'san andres': 'SA', 'san andrés': 'SA', 'san andres y providencia': 'SA',
  'santander': 'SN', 'sucre': 'SU', 'tolima': 'TO',
  'valle del cauca': 'VC', 'valle': 'VC',
  'vaupes': 'VA', 'vaupés': 'VA', 'vichada': 'VI'
};

function getStateCode(department: string): string {
  const normalized = department.trim();
  const upper = normalized.toUpperCase();
  const lower = normalized.toLowerCase();
  
  if (SHOPIFY_TO_ENVIA_CODES[upper]) {
    return SHOPIFY_TO_ENVIA_CODES[upper];
  }
  
  const validEnviaCodes = Object.values(COLOMBIA_STATE_CODES);
  if (upper.length === 2 && validEnviaCodes.includes(upper)) {
    return upper;
  }
  
  return COLOMBIA_STATE_CODES[lower] || 'DC';
}

// Dosmicos origin
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
  postalCode: "111321"
};

interface QuoteRequest {
  destination_city: string;
  destination_department: string;
  destination_postal_code?: string;
  package_weight?: number;
  declared_value?: number;
}

interface CarrierQuote {
  carrier: string;
  service: string;
  price: number;
  currency: string;
  estimated_days: number;
  deliveryEstimate?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ENVIA_API_KEY = Deno.env.get('ENVIA_API_KEY');

    if (!ENVIA_API_KEY) {
      console.error('❌ ENVIA_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key de Envia.com no configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const body: QuoteRequest = await req.json();

    console.log('💰 Getting shipping quote for:', body.destination_city, body.destination_department);

    if (!body.destination_city || !body.destination_department) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere ciudad y departamento de destino' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const stateCode = getStateCode(body.destination_department);
    console.log(`📍 Department "${body.destination_department}" -> State code "${stateCode}"`);

    // Build rate request following Envia.com API docs
    const rateRequest = {
      origin: {
        country: "CO",
        state: "DC",
        city: "Bogota",
        postalCode: "111321"
      },
      destination: {
        country: "CO",
        state: stateCode,
        city: body.destination_city,
        postalCode: body.destination_postal_code || "000000"
      },
      packages: [{
        content: "Ropa",
        amount: 1,
        type: "box",
        weight: body.package_weight || 1,
        insurance: 0,
        declaredValue: body.declared_value || 100000,
        weightUnit: "KG",
        lengthUnit: "CM",
        dimensions: {
          length: 30,
          width: 25,
          height: 10
        }
      }],
      settings: {
        currency: "COP"
      }
    };

    console.log('📤 Sending rate request to Envia.com API...');
    console.log('📤 Request payload:', JSON.stringify(rateRequest, null, 2));

    // Call Envia.com Rate API
    const enviaResponse = await fetch('https://api.envia.com/ship/rate/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENVIA_API_KEY}`
      },
      body: JSON.stringify(rateRequest)
    });

    const enviaData = await enviaResponse.json();
    console.log('📥 Envia.com rate response status:', enviaResponse.status);
    console.log('📥 Envia.com rate response:', JSON.stringify(enviaData, null, 2));

    if (!enviaResponse.ok || enviaData.meta === 'error') {
      const errorMsg = enviaData?.error?.message || enviaData?.message || 'Error al obtener cotización';
      console.error('❌ Envia.com rate error:', errorMsg);
      return new Response(
        JSON.stringify({ success: false, error: errorMsg, details: enviaData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Parse quotes from response
    const quotes: CarrierQuote[] = [];
    
    if (enviaData.data && Array.isArray(enviaData.data)) {
      for (const rate of enviaData.data) {
        quotes.push({
          carrier: rate.carrier || 'unknown',
          service: rate.service || 'ground',
          price: rate.totalPrice || rate.price || 0,
          currency: rate.currency || 'COP',
          estimated_days: rate.deliveryDays || rate.days || 0,
          deliveryEstimate: rate.deliveryEstimate || null
        });
      }
    }

    // Sort by price (cheapest first)
    quotes.sort((a, b) => a.price - b.price);

    console.log(`✅ Got ${quotes.length} quotes`);

    return new Response(
      JSON.stringify({
        success: true,
        quotes,
        destination: {
          city: body.destination_city,
          department: body.destination_department,
          state_code: stateCode
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error in envia-quote:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
