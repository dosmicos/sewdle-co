import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Get state code from department name
function getStateCode(department: string): string {
  const normalized = department.trim();
  const upper = normalized.toUpperCase();
  
  // Check Shopify codes first
  if (SHOPIFY_TO_ENVIA_CODES[upper]) {
    return SHOPIFY_TO_ENVIA_CODES[upper];
  }
  
  // Check department names
  const lowerDept = normalized.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const [deptName, code] of Object.entries(COLOMBIA_STATE_CODES)) {
    const normalizedDeptName = deptName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lowerDept.includes(normalizedDeptName) || normalizedDeptName.includes(lowerDept)) {
      return code;
    }
  }
  
  // Default to Bogotá/DC
  console.log(`⚠️ Department "${department}" not found, defaulting to DC`);
  return 'DC';
}

// Levenshtein distance algorithm for fuzzy matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length, n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s1[i-1] === s2[j-1] 
        ? dp[i-1][j-1] 
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const s2 = str2.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  return (maxLen - levenshteinDistance(s1, s2)) / maxLen;
}

interface CityMatchInfo {
  matchType: 'exact' | 'fuzzy' | 'not_found';
  inputCity: string;
  matchedMunicipality: string | null;
  matchedDepartment: string | null;
  confidence: number;
  suggestions: Array<{ municipality: string; department: string; similarity: number }>;
}

interface DaneCodeResult {
  daneCode: string;
  matchInfo: CityMatchInfo;
}

// Get DANE code from database with match info - uses indexed normalized column
async function getDaneCodeWithMatchInfo(supabase: any, city: string, department?: string): Promise<DaneCodeResult> {
  const originalCity = city.trim();
  const normalizedCity = city.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  console.log(`🔍 Looking up DANE code for city: "${originalCity}" (normalized: "${normalizedCity}")`);

  // Step 1: Exact match using indexed municipality_normalized column (ignores department)
  const { data: exactMatches, error: exactErr } = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department')
    .eq('municipality_normalized', normalizedCity);

  if (exactErr) {
    console.error('❌ Error in exact DANE lookup:', exactErr);
  }

  if (exactMatches && exactMatches.length === 1) {
    console.log(`✅ DANE found (exact, unique): "${originalCity}" → "${exactMatches[0].dane_code}" (${exactMatches[0].municipality}, ${exactMatches[0].department})`);
    return {
      daneCode: exactMatches[0].dane_code,
      matchInfo: {
        matchType: 'exact',
        inputCity: originalCity,
        matchedMunicipality: exactMatches[0].municipality,
        matchedDepartment: exactMatches[0].department,
        confidence: 1.0,
        suggestions: []
      }
    };
  }

  if (exactMatches && exactMatches.length > 1) {
    // Multiple matches — use department to disambiguate
    const normalizedDept = department?.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';

    if (normalizedDept) {
      const deptMatch = exactMatches.find((r: any) => {
        const rd = r.department.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return rd === normalizedDept || rd.includes(normalizedDept) || normalizedDept.includes(rd);
      });
      if (deptMatch) {
        console.log(`✅ DANE found (exact + dept): "${originalCity}" → "${deptMatch.dane_code}" (${deptMatch.municipality}, ${deptMatch.department})`);
        return {
          daneCode: deptMatch.dane_code,
          matchInfo: {
            matchType: 'exact',
            inputCity: originalCity,
            matchedMunicipality: deptMatch.municipality,
            matchedDepartment: deptMatch.department,
            confidence: 1.0,
            suggestions: []
          }
        };
      }
    }

    // Default to first match
    console.log(`⚠️ Multiple matches, using first: ${exactMatches[0].municipality}, ${exactMatches[0].department}`);
    return {
      daneCode: exactMatches[0].dane_code,
      matchInfo: {
        matchType: 'exact',
        inputCity: originalCity,
        matchedMunicipality: exactMatches[0].municipality,
        matchedDepartment: exactMatches[0].department,
        confidence: 0.8,
        suggestions: exactMatches.slice(0, 3).map((s: any) => ({
          municipality: s.municipality,
          department: s.department,
          similarity: 1.0
        }))
      }
    };
  }

  // Step 2: Fuzzy match with Levenshtein
  console.log(`🔄 No exact match, trying fuzzy for "${originalCity}"...`);

  const { data: allMunicipalities } = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department, municipality_normalized');

  if (allMunicipalities && allMunicipalities.length > 0) {
    const scored = allMunicipalities
      .map((row: any) => ({
        ...row,
        distance: levenshteinDistance(normalizedCity, row.municipality_normalized || row.municipality.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      }))
      .filter((row: any) => row.distance <= 3)
      .sort((a: any, b: any) => a.distance - b.distance);

    if (scored.length > 0) {
      const best = scored[0];
      const similarity = 1 - (best.distance / Math.max(normalizedCity.length, (best.municipality_normalized || best.municipality).length));
      console.log(`✅ Fuzzy match (distance=${best.distance}): "${originalCity}" → "${best.municipality}" (${best.department})`);

      return {
        daneCode: best.dane_code,
        matchInfo: {
          matchType: 'fuzzy',
          inputCity: originalCity,
          matchedMunicipality: best.municipality,
          matchedDepartment: best.department,
          confidence: similarity,
          suggestions: scored.slice(0, 3).map((s: any) => ({
            municipality: s.municipality,
            department: s.department,
            similarity: 1 - (s.distance / Math.max(normalizedCity.length, (s.municipality_normalized || s.municipality).length))
          }))
        }
      };
    }
  }

  // No match found
  console.log(`❌ DANE code not found for "${originalCity}", returning not_found`);
  return {
    daneCode: '11001000',
    matchInfo: {
      matchType: 'not_found',
      inputCity: originalCity,
      matchedMunicipality: null,
      matchedDepartment: null,
      confidence: 0,
      suggestions: []
    }
  };
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
  serviceDisplayName: string;
  deliveryType: 'domicilio' | 'oficina';
  deliveryTypeLabel: string;
  price: number;
  currency: string;
  estimated_days: number;
  deliveryEstimate?: string;
}

// Service display names - readable names for services
const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  'ecommerce': 'Ecommerce',
  'ground': 'Ground',
  'estandar': 'Estándar',
  'ground_small': 'Mensajería',
  'terrestre': 'Terrestre'
};

// Delivery type labels
const DELIVERY_TYPE_LABELS: Record<string, string> = {
  'domicilio': 'Domicilio - Domicilio',
  'oficina': 'Domicilio - Sucursal'
};

// Shipment types
const SHIPMENT_TYPES = [
  { type: 1, label: 'domicilio' as const },  // Door to door
  { type: 2, label: 'oficina' as const }     // Door to branch/office
];

// Only these 3 carriers
const AVAILABLE_CARRIERS = ['coordinadora', 'interrapidisimo', 'deprisa'];

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

    // Initialize Supabase client for database queries
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: QuoteRequest = await req.json();

    console.log('💰 Getting shipping quote for:', body.destination_city, body.destination_department);

    if (!body.destination_city || !body.destination_department) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere ciudad y departamento de destino' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const stateCode = getStateCode(body.destination_department);
    // Get DANE code from database with match info
    const { daneCode: destinationDaneCode, matchInfo } = await getDaneCodeWithMatchInfo(supabase, body.destination_city, body.destination_department);
    console.log(`📍 Department "${body.destination_department}" -> State code "${stateCode}"`);
    console.log(`📍 City "${body.destination_city}" -> DANE code "${destinationDaneCode}" (match: ${matchInfo.matchType})`);

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
        weight: body.package_weight || 0.5,
        insurance: 0,
        declaredValue: body.declared_value || 100000,
        weightUnit: "KG",
        lengthUnit: "CM",
        dimensions: {
          length: 20,
          width: 10,
          height: 6
        }
      }],
      shipment: {
        type: 1
      },
      settings: {
        currency: "COP"
      }
    };

    console.log('📤 Getting quotes for carriers:', AVAILABLE_CARRIERS.join(', '));
    console.log('📦 Shipment types: domicilio (type=1) and oficina (type=2)');

    // Make parallel requests for each carrier × shipment type combination
    const ratePromises: Promise<{ carrier: string; deliveryType: 'domicilio' | 'oficina'; success: boolean; data?: any; error?: string }>[] = [];
    
    for (const carrier of AVAILABLE_CARRIERS) {
      for (const shipmentType of SHIPMENT_TYPES) {
        const requestWithCarrier = {
          ...rateRequest,
          shipment: { type: shipmentType.type, carrier }
        };

        const promise = (async () => {
          try {
            console.log(`📤 Requesting ${shipmentType.label} quote from ${carrier}...`);
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
              console.log(`⚠️ Invalid JSON from ${carrier} (${shipmentType.label}):`, text.substring(0, 100));
              return { carrier, deliveryType: shipmentType.label, success: false, error: 'Invalid response' };
            }

            if (data.meta === 'error') {
              console.log(`⚠️ ${carrier} (${shipmentType.label}) error:`, data.error?.message || 'Unknown error');
              return { carrier, deliveryType: shipmentType.label, success: false, error: data.error?.message };
            }

            console.log(`✅ Got ${shipmentType.label} quote from ${carrier}`);
            return { carrier, deliveryType: shipmentType.label, success: true, data };
          } catch (error: any) {
            console.log(`❌ Error getting ${shipmentType.label} quote from ${carrier}:`, error.message);
            return { carrier, deliveryType: shipmentType.label, success: false, error: error.message };
          }
        })();

        ratePromises.push(promise);
      }
    }

    // Wait for all requests (3 carriers × 2 types = 6 requests)
    const results = await Promise.all(ratePromises);

    // Combine successful quotes - ONLY ground/terrestrial services
    const allQuotes: CarrierQuote[] = [];
    
    // Valid ground service names (different carriers use different names)
    const GROUND_SERVICES = ['ground', 'ecommerce', 'estandar', 'ground_small', 'terrestre'];

    for (const result of results) {
      if (result.success && result.data?.data && Array.isArray(result.data.data)) {
        for (const rate of result.data.data) {
          const service = (rate.service || 'ground').toLowerCase();
          
          // ✅ Only include ground/terrestrial services
          const isGroundService = GROUND_SERVICES.some(gs => service.includes(gs));
          if (!isGroundService) {
            console.log(`⏭️ Skipping ${result.carrier} ${service} (not ground)`);
            continue;
          }

          // Get display name for service
          let serviceDisplayName = SERVICE_DISPLAY_NAMES[service] || service;
          // If not found by exact match, try partial match
          if (!SERVICE_DISPLAY_NAMES[service]) {
            for (const [key, name] of Object.entries(SERVICE_DISPLAY_NAMES)) {
              if (service.includes(key)) {
                serviceDisplayName = name;
                break;
              }
            }
          }

          console.log(`✅ Including ${result.carrier} ${service} (${result.deliveryType}) - $${rate.totalPrice || rate.price}`);
          
          allQuotes.push({
            carrier: rate.carrier || result.carrier,
            service: service,
            serviceDisplayName: serviceDisplayName.charAt(0).toUpperCase() + serviceDisplayName.slice(1),
            deliveryType: result.deliveryType,
            deliveryTypeLabel: DELIVERY_TYPE_LABELS[result.deliveryType] || result.deliveryType,
            price: rate.totalPrice || rate.price || 0,
            currency: rate.currency || 'COP',
            estimated_days: rate.deliveryDays || rate.days || 0,
            deliveryEstimate: rate.deliveryEstimate || null
          });
        }
      }
    }

    // Keep only the cheapest quote per carrier + service + deliveryType combination
    const uniqueQuotes = new Map<string, CarrierQuote>();
    for (const quote of allQuotes) {
      const key = `${quote.carrier}-${quote.service}-${quote.deliveryType}`;
      const existing = uniqueQuotes.get(key);
      if (!existing || quote.price < existing.price) {
        uniqueQuotes.set(key, quote);
      }
    }
    const quotes = Array.from(uniqueQuotes.values());

    // Sort by price (cheapest first)
    quotes.sort((a, b) => a.price - b.price);
    
    // Separate by delivery type
    const domicilioQuotes = quotes.filter(q => q.deliveryType === 'domicilio');
    const oficinaQuotes = quotes.filter(q => q.deliveryType === 'oficina');

    console.log(`✅ Got ${quotes.length} total ground quotes (${domicilioQuotes.length} domicilio, ${oficinaQuotes.length} oficina)`);

    return new Response(
      JSON.stringify({
        success: true,
        quotes,
        domicilio: domicilioQuotes,
        oficina: oficinaQuotes,
        destination: {
          city: matchInfo.matchedMunicipality || body.destination_city,
          department: matchInfo.matchedDepartment || body.destination_department,
          state_code: stateCode,
          dane_code: destinationDaneCode
        },
        matchInfo
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
