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

// Colombia DANE codes (8 digits) for cities
const COLOMBIA_DANE_CODES: Record<string, string> = {
  'bogota': '11001000', 'bogotá': '11001000',
  'medellin': '05001000', 'medellín': '05001000',
  'cali': '76001000', 'barranquilla': '08001000',
  'cartagena': '13001000', 'bucaramanga': '68001000',
  'cucuta': '54001000', 'cúcuta': '54001000',
  'pereira': '66001000', 'villavicencio': '50001000',
  'pasto': '52001000', 'santa marta': '47001000',
  'monteria': '23001000', 'montería': '23001000',
  'armenia': '63001000', 'popayan': '19001000', 'popayán': '19001000',
  'sincelejo': '70001000', 'valledupar': '20001000',
  'tunja': '15001000', 'florencia': '18001000',
  'riohacha': '44001000', 'ibague': '73001000', 'ibagué': '73001000',
  'neiva': '41001000', 'manizales': '17001000',
  'soacha': '25754000', 'soledad': '08758000',
  'bello': '05088000', 'itagui': '05360000', 'itagüí': '05360000',
  'envigado': '05266000', 'buenaventura': '76109000',
  'palmira': '76520000', 'floridablanca': '68276000',
  'tulua': '76834000', 'tuluá': '76834000',
  'dosquebradas': '66170000', 'apartado': '05045000', 'apartadó': '05045000',
  'barrancabermeja': '68081000', 'girardot': '25307000',
  'chia': '25175000', 'chía': '25175000',
  'zipaquira': '25899000', 'zipaquirá': '25899000',
  'facatativa': '25269000', 'facatativá': '25269000',
  'funza': '25286000', 'madrid': '25430000',
  'mosquera': '25473000', 'cajica': '25126000', 'cajicá': '25126000',
  'girardota': '05308000', 'rionegro': '05615000',
  'la ceja': '05376000', 'marinilla': '05440000',
  'sabaneta': '05631000', 'copacabana': '05212000',
  'caldas': '05129000', 'la estrella': '05380000'
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

function getDaneCode(city: string): string {
  const normalized = city.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Check exact match first
  if (COLOMBIA_DANE_CODES[city.toLowerCase().trim()]) {
    return COLOMBIA_DANE_CODES[city.toLowerCase().trim()];
  }
  
  // Check normalized match
  for (const [key, code] of Object.entries(COLOMBIA_DANE_CODES)) {
    const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedKey === normalized) {
      return code;
    }
  }
  
  // Default to Bogotá
  return '11001000';
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
    const destinationDaneCode = getDaneCode(body.destination_city);
    console.log(`📍 Department "${body.destination_department}" -> State code "${stateCode}"`);
    console.log(`📍 City "${body.destination_city}" -> DANE code "${destinationDaneCode}"`);

    // Build rate request following Envia.com API docs
    const rateRequest = {
      origin: {
        country: "CO",
        state: "DC",
        city: "11001000",      // Bogotá DANE code
        postalCode: "11001000" // Same DANE code
      },
      destination: {
        country: "CO",
        state: stateCode,
        city: destinationDaneCode,
        postalCode: destinationDaneCode
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
      shipment: {
        type: 1
      },
      settings: {
        currency: "COP"
      }
    };

    // Only these 3 carriers
    const AVAILABLE_CARRIERS = ['coordinadora', 'interrapidisimo', 'deprisa'];

    console.log('📤 Getting quotes for carriers:', AVAILABLE_CARRIERS.join(', '));

    // Make parallel requests for each carrier
    const ratePromises = AVAILABLE_CARRIERS.map(async (carrier) => {
      const requestWithCarrier = {
        ...rateRequest,
        shipment: { type: 1, carrier }
      };

      try {
        console.log(`📤 Requesting quote from ${carrier}...`);
        const response = await fetch('https://api.envia.com/ship/rate/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ENVIA_API_KEY}`
          },
          body: JSON.stringify(requestWithCarrier)
        });

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.log(`⚠️ Invalid JSON from ${carrier}:`, text.substring(0, 100));
          return { carrier, success: false, error: 'Invalid response' };
        }

        if (data.meta === 'error') {
          console.log(`⚠️ ${carrier} error:`, data.error?.message || 'Unknown error');
          return { carrier, success: false, error: data.error?.message };
        }

        console.log(`✅ Got quote from ${carrier}`);
        return { carrier, success: true, data };
      } catch (error: any) {
        console.log(`❌ Error getting quote from ${carrier}:`, error.message);
        return { carrier, success: false, error: error.message };
      }
    });

    // Wait for all requests
    const results = await Promise.all(ratePromises);

    // Combine successful quotes
    const quotes: CarrierQuote[] = [];

    for (const result of results) {
      if (result.success && result.data?.data && Array.isArray(result.data.data)) {
        for (const rate of result.data.data) {
          quotes.push({
            carrier: rate.carrier || result.carrier,
            service: rate.service || 'ground',
            price: rate.totalPrice || rate.price || 0,
            currency: rate.currency || 'COP',
            estimated_days: rate.deliveryDays || rate.days || 0,
            deliveryEstimate: rate.deliveryEstimate || null
          });
        }
      }
    }

    // Sort by price (cheapest first)
    quotes.sort((a, b) => a.price - b.price);

    console.log(`✅ Got ${quotes.length} total quotes from ${results.filter(r => r.success).length} carriers`);

    return new Response(
      JSON.stringify({
        success: true,
        quotes,
        destination: {
          city: body.destination_city,
          department: body.destination_department,
          state_code: stateCode,
          dane_code: destinationDaneCode
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
