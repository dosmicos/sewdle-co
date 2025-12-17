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
  // Caquetá
  'caqueta': 'CA', 'caquetá': 'CA',
  // Casanare
  'casanare': 'CS',
  // Cauca
  'cauca': 'CU',
  // Cesar
  'cesar': 'CE',
  // Chocó
  'choco': 'CH', 'chocó': 'CH',
  // Córdoba
  'cordoba': 'CO', 'córdoba': 'CO',
  // Cundinamarca
  'cundinamarca': 'CN',
  // Guainía
  'guainia': 'GU', 'guainía': 'GU',
  // Guaviare
  'guaviare': 'GA',
  // Huila
  'huila': 'HU',
  // La Guajira
  'la guajira': 'LG', 'guajira': 'LG',
  // Magdalena
  'magdalena': 'MA',
  // Meta
  'meta': 'ME',
  // Nariño
  'narino': 'NA', 'nariño': 'NA',
  // Norte de Santander
  'norte de santander': 'NS',
  // Putumayo
  'putumayo': 'PU',
  // Quindío
  'quindio': 'QU', 'quindío': 'QU',
  // Risaralda
  'risaralda': 'RI',
  // San Andrés y Providencia
  'san andres': 'SA', 'san andres y providencia': 'SA', 'san andrés': 'SA', 'san andrés y providencia': 'SA',
  // Santander
  'santander': 'SN',
  // Sucre
  'sucre': 'SU',
  // Tolima
  'tolima': 'TO',
  // Valle del Cauca
  'valle del cauca': 'VC', 'valle': 'VC',
  // Vaupés
  'vaupes': 'VA', 'vaupés': 'VA',
  // Vichada
  'vichada': 'VI'
};

// Colombia DANE CODES - Required for Envia.com API city and postalCode fields
// According to Envia.com docs, Colombia uses 8-digit DANE codes for both city and postalCode
const COLOMBIA_DANE_CODES: Record<string, string> = {
  // Bogotá D.C.
  'bogota': '11001000',
  'bogota d.c.': '11001000',
  'bogota dc': '11001000',
  // Antioquia
  'medellin': '05001000',
  'envigado': '05266000',
  'sabaneta': '05631000',
  'itagui': '05360000',
  'bello': '05088000',
  'rionegro': '05615000',
  'la estrella': '05380000',
  'caldas': '05129000',
  'copacabana': '05212000',
  'girardota': '05308000',
  'barbosa': '05079000',
  // Valle del Cauca
  'cali': '76001000',
  'palmira': '76520000',
  'buenaventura': '76109000',
  'tulua': '76834000',
  'buga': '76111000',
  'cartago': '76147000',
  'yumbo': '76892000',
  // Atlántico
  'barranquilla': '08001000',
  'soledad': '08758000',
  'malambo': '08433000',
  // Bolívar
  'cartagena': '13001000',
  'turbaco': '13836000',
  'magangue': '13430000',
  // Santander
  'bucaramanga': '68001000',
  'floridablanca': '68276000',
  'giron': '68307000',
  'piedecuesta': '68547000',
  'barrancabermeja': '68081000',
  // Norte de Santander
  'cucuta': '54001000',
  'villa del rosario': '54874000',
  'los patios': '54405000',
  // Risaralda
  'pereira': '66001000',
  'dosquebradas': '66170000',
  'santa rosa de cabal': '66682000',
  // Caldas
  'manizales': '17001000',
  'villamaria': '17873000',
  // Tolima
  'ibague': '73001000',
  'espinal': '73268000',
  // Magdalena
  'santa marta': '47001000',
  'cienaga': '47189000',
  // Córdoba
  'monteria': '23001000',
  'cerete': '23162000',
  // Meta
  'villavicencio': '50001000',
  'acacias': '50006000',
  // Nariño
  'pasto': '52001000',
  'tumaco': '52835000',
  'ipiales': '52356000',
  // Huila
  'neiva': '41001000',
  'pitalito': '41551000',
  // Quindío
  'armenia': '63001000',
  'calarca': '63130000',
  // Cauca
  'popayan': '19001000',
  'santander de quilichao': '19698000',
  // Sucre
  'sincelejo': '70001000',
  'corozal': '70215000',
  // Cesar
  'valledupar': '20001000',
  'aguachica': '20011000',
  // Boyacá
  'tunja': '15001000',
  'duitama': '15238000',
  'sogamoso': '15759000',
  // Caquetá
  'florencia': '18001000',
  // La Guajira
  'riohacha': '44001000',
  'maicao': '44430000',
  // Chocó
  'quibdo': '27001000',
  // Casanare
  'yopal': '85001000',
  'aguazul': '85010000',
  // Putumayo
  'mocoa': '86001000',
  // Amazonas
  'leticia': '91001000',
  // Guainía
  'inirida': '94001000',
  // Vaupés
  'mitu': '97001000',
  // Vichada
  'puerto carreno': '99001000',
  // Guaviare
  'san jose del guaviare': '95001000',
  // Arauca
  'arauca': '81001000',
  // Cundinamarca (municipalities near Bogotá)
  'soacha': '25754000',
  'chia': '25175000',
  'zipaquira': '25899000',
  'facatativa': '25269000',
  'madrid': '25430000',
  'funza': '25286000',
  'mosquera': '25473000',
  'cajica': '25126000',
  'cota': '25214000',
  'la calera': '25377000',
  'fusagasuga': '25290000',
  'girardot': '25307000',
  'tocancipa': '25817000',
  'sopo': '25758000',
  'tabio': '25785000',
  'tenjo': '25799000',
  'sibate': '25740000',
  'silvania': '25743000',
  'villeta': '25873000'
};

// Get DANE code for a city
function getDaneCode(city: string, department?: string): string {
  const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Direct match
  if (COLOMBIA_DANE_CODES[normalizedCity]) {
    console.log(`📮 DANE code found: "${city}" → "${COLOMBIA_DANE_CODES[normalizedCity]}"`);
    return COLOMBIA_DANE_CODES[normalizedCity];
  }
  
  // Partial match
  for (const [cityKey, daneCode] of Object.entries(COLOMBIA_DANE_CODES)) {
    if (normalizedCity.includes(cityKey) || cityKey.includes(normalizedCity)) {
      console.log(`📮 DANE code partial match: "${city}" → "${daneCode}"`);
      return daneCode;
    }
  }
  
  console.log(`⚠️ No DANE code found for city: "${city}", using Bogota fallback (11001000)`);
  return '11001000'; // Default to Bogota
}

// Shopify province codes to Envia.com state codes mapping
// Shopify uses 3-character codes for Colombian departments
const SHOPIFY_TO_ENVIA_CODES: Record<string, string> = {
  'AMA': 'AM', // Amazonas
  'ANT': 'AN', // Antioquia
  'ARA': 'AR', // Arauca
  'ATL': 'AT', // Atlántico
  'BOG': 'DC', // Bogotá D.C.
  'DC': 'DC',  // Bogotá (alternative)
  'BOL': 'BL', // Bolívar
  'BOY': 'BY', // Boyacá
  'CAL': 'CL', // Caldas
  'CAQ': 'CA', // Caquetá
  'CAS': 'CS', // Casanare
  'CAU': 'CU', // Cauca
  'CES': 'CE', // Cesar
  'CHO': 'CH', // Chocó
  'COR': 'CO', // Córdoba
  'CUN': 'CN', // Cundinamarca
  'GUA': 'GU', // Guainía
  'GUV': 'GA', // Guaviare
  'HUI': 'HU', // Huila
  'LAG': 'LG', // La Guajira
  'MAG': 'MA', // Magdalena
  'MET': 'ME', // Meta
  'NAR': 'NA', // Nariño
  'NSA': 'NS', // Norte de Santander
  'PUT': 'PU', // Putumayo
  'QUI': 'QU', // Quindío
  'RIS': 'RI', // Risaralda
  'SAP': 'SA', // San Andrés y Providencia
  'SAN': 'SN', // Santander
  'SUC': 'SU', // Sucre
  'TOL': 'TO', // Tolima
  'VAC': 'VC', // Valle del Cauca
  'VAU': 'VA', // Vaupés
  'VID': 'VI'  // Vichada
};

// Get state code from department name or Shopify code
function getStateCode(department: string): string {
  const normalized = department.trim();
  const upper = normalized.toUpperCase();
  const lower = normalized.toLowerCase();
  
  // First check if it's a Shopify 3-character code
  if (SHOPIFY_TO_ENVIA_CODES[upper]) {
    console.log(`🔄 Shopify code "${upper}" -> Envia code "${SHOPIFY_TO_ENVIA_CODES[upper]}"`);
    return SHOPIFY_TO_ENVIA_CODES[upper];
  }
  
  // Then check if it's already a valid 2-character Envia code
  const validEnviaCodes = Object.values(COLOMBIA_STATE_CODES);
  if (upper.length === 2 && validEnviaCodes.includes(upper)) {
    return upper;
  }
  
  // Finally, look up by department name
  return COLOMBIA_STATE_CODES[lower] || 'DC'; // Default to Bogota if unknown
}

// (lookupEnviaCity function defined below, after extractDistrict and parseAddress)

// Extract district/neighborhood from address
function extractDistrict(address: string, city: string): string {
  // Common patterns for Colombian addresses with neighborhood info
  const patterns = [
    /barrio\s+([^,\n]+)/i,
    /br\.\s*([^,\n]+)/i,
    /b\/\s*([^,\n]+)/i,
    /sector\s+([^,\n]+)/i,
    /urbanizaci[oó]n\s+([^,\n]+)/i,
    /urb\.\s*([^,\n]+)/i,
    /conjunto\s+([^,\n]+)/i,
    /conj\.\s*([^,\n]+)/i,
    /edificio\s+([^,\n]+)/i,
    /ed\.\s*([^,\n]+)/i,
    /manzana\s+([^,\n]+)/i,
    /mz\.\s*([^,\n]+)/i,
    /localidad\s+([^,\n]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match && match[1]) {
      const district = match[1].trim().replace(/[,\n].*$/, '');
      console.log(`📍 Extracted district "${district}" from address`);
      return district;
    }
  }
  
  // If no pattern matched, try to extract from address parts
  const parts = address.split(/[,\-]/);
  if (parts.length >= 3) {
    // Usually the neighborhood is in the 2nd or 3rd part
    const possibleDistrict = parts[1]?.trim() || parts[2]?.trim();
    if (possibleDistrict && possibleDistrict.length > 2 && !/^\d+/.test(possibleDistrict)) {
      console.log(`📍 Using address part as district: "${possibleDistrict}"`);
      return possibleDistrict;
    }
  }
  
  // Fallback to city
  console.log(`📍 No district found, using city: "${city}"`);
  return city;
}

// Parse address into street and number
function parseAddress(address: string): { street: string; number: string } {
  // Colombian address patterns
  const patterns = [
    // Cra 27 # 63B-61
    /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s*[#]\s*(\d+[a-z]?\s*-?\s*\d*)/i,
    // Cra 27 No. 63B-61
    /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s*(?:no\.?|n°|num\.?)\s*(\d+[a-z]?\s*-?\s*\d*)/i,
    // Cra 27 63B-61 (without separator)
    /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s+(\d+[a-z]?\s*-?\s*\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      return {
        street: match[1].trim(),
        number: match[2].trim()
      };
    }
  }
  
  // Fallback: split by common separators
  const parts = address.split(/[,#]/);
  return {
    street: parts[0]?.trim() || address,
    number: parts[1]?.trim() || "S/N"
  };
}

// ============= ENVIA.COM QUERIES API LOOKUP =============
// Use Envia.com's Queries API to get exact city/territory codes
interface EnviaCityInfo {
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

async function lookupEnviaCity(country: string, cityName: string, apiKey: string): Promise<EnviaCityInfo | null> {
  try {
    const normalizedCity = encodeURIComponent(cityName.trim());
    const url = `https://queries.envia.com/locate/${country}/${normalizedCity}`;

    console.log(`🔍 Looking up city (Queries API): ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ City lookup failed with status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`📍 Lookup result for "${cityName}":`, JSON.stringify(data, null, 2));
    
    // The API returns an array of matches - take the first one
    if (data && Array.isArray(data) && data.length > 0) {
      const match = data[0];
      return {
        city: match.city || match.name || cityName,
        state: match.state || match.stateCode || "",
        zipCode: match.zipCode || match.postalCode || match.code || ""
      };
    }
    
    // If data is a single object (not array)
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return {
        city: data.city || data.name || cityName,
        state: data.state || data.stateCode || "",
        zipCode: data.zipCode || data.postalCode || data.code || ""
      };
    }
    
    console.log(`⚠️ No results found for city "${cityName}"`);
    return null;
  } catch (error) {
    console.error(`❌ Error looking up city "${cityName}":`, error);
    return null;
  }
}

// Dosmicos origin address - includes addressId + full address data
const DOSMICOS_ORIGIN = {
  addressId: 901172720,
  name: "Julian Castro",
  company: "dosmicos sas",
  email: "dosmicoscol@gmail.com",
  phone: "3125456340",
  street: "Cra 27 # 63b -61 Barrio Quinta de Mutis",
  number: "",
  district: "Barrio Quinta de Mutis",
  city: "11001000",        // Código DANE 8 dígitos para Bogotá
  state: "DC",
  country: "CO",
  postalCode: "11001000",  // Código DANE 8 dígitos
  reference: "CASA 1er piso de rejas negras",
  taxIdentification: "901412407"
};

// Default package dimensions
const DEFAULT_PACKAGE = {
  content: "Ropa infantil",
  amount: 1,
  type: "box",
  weight: 0.5,
  insurance: 0,
  declaredValue: 100000,
  weightUnit: "KG",
  lengthUnit: "CM",
  dimensions: {
    length: 20,
    width: 10,
    height: 6
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

// Main cities for Deprisa (paid orders only)
const MAIN_CITIES = [
  'cali', 'barranquilla', 'cartagena', 'bucaramanga', 'cucuta', 'cúcuta',
  'pereira', 'villavicencio', 'pasto', 'santa marta', 'monteria', 'montería',
  'armenia', 'popayan', 'popayán', 'sincelejo', 'valledupar',
  'tunja', 'florencia', 'riohacha'
];

// Normalize text for comparison (removes accents and lowercases)
function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Automatic carrier selection based on business rules:
 * 1. Cundinamarca (including Bogotá) → Coordinadora (COD y pagado)
 * 2. Medellín, Antioquia → Coordinadora (COD y pagado)
 * 3. Ciudades principales + pedido PAGADO → Deprisa (NO acepta COD)
 * 4. Ciudades principales + COD → Inter Rapidísimo (porque Deprisa no acepta COD)
 * 5. Ciudades remotas/no principales → Inter Rapidísimo (COD y pagado)
 */
function selectCarrierByRules(city: string, department: string, isCOD: boolean): string {
  const normalizedCity = normalizeText(city);
  const normalizedDept = normalizeText(department);

  console.log(`🔄 Selecting carrier - City: "${normalizedCity}", Dept: "${normalizedDept}", COD: ${isCOD}`);

  // Rule 1: Cundinamarca (includes Bogotá) → Coordinadora (accepts both COD and paid)
  if (normalizedDept.includes('cundinamarca') ||
      normalizedDept.includes('bogota') ||
      normalizedDept === 'dc' ||
      normalizedCity.includes('bogota')) {
    console.log('📍 Rule 1: Cundinamarca/Bogotá → Coordinadora (acepta COD y pagado)');
    return 'coordinadora';
  }

  // Rule 2: Medellín, Antioquia → Coordinadora (accepts both COD and paid)
  if (normalizedDept.includes('antioquia') && normalizedCity.includes('medellin')) {
    console.log('📍 Rule 2: Medellín, Antioquia → Coordinadora (acepta COD y pagado)');
    return 'coordinadora';
  }

  // Check if it's a main city
  const isMainCity = MAIN_CITIES.some(mainCity => {
    const normalizedMainCity = normalizeText(mainCity);
    return normalizedCity.includes(normalizedMainCity) || normalizedMainCity.includes(normalizedCity);
  });

  // Rule 3: Main cities + PAID orders → Deprisa (Deprisa does NOT accept COD)
  if (isMainCity && !isCOD) {
    console.log(`📍 Rule 3: Ciudad principal "${city}" + Pagado → Deprisa`);
    return 'deprisa';
  }

  // Rule 4: Main cities + COD → Inter Rapidísimo (because Deprisa doesn't accept COD)
  if (isMainCity && isCOD) {
    console.log(`📍 Rule 4: Ciudad principal "${city}" + COD → Inter Rapidísimo (Deprisa no acepta COD)`);
    return 'interrapidisimo';
  }

  // Rule 5: Non-main cities (remote areas) → Inter Rapidísimo (COD or paid)
  console.log(`📍 Rule 5: Ciudad remota "${city}" → Inter Rapidísimo`);
  return 'interrapidisimo';
}

interface CreateLabelRequest {
  shopify_order_id: number;
  organization_id: string;
  order_number: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  destination_address: string;
  destination_address2?: string; // Apartamento, torre, etc.
  destination_city: string;
  destination_department: string;
  destination_postal_code?: string;
  package_content?: string;
  package_weight?: number;
  declared_value?: number;
  preferred_carrier?: string;
  is_cod?: boolean; // Cash on Delivery
  cod_amount?: number; // Amount to collect on delivery
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
    console.log('📍 Full address:', body.destination_address);
    console.log('📍 Address2 (apt/tower):', body.destination_address2 || '(none)');

    // Validate required fields
    if (!body.destination_address || !body.destination_city) {
      console.error('❌ Missing required address fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Dirección incompleta: se requiere dirección y ciudad' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Delete any previous failed labels for this order (allows retry)
    await supabase
      .from('shipping_labels')
      .delete()
      .eq('shopify_order_id', body.shopify_order_id)
      .eq('organization_id', body.organization_id)
      .eq('status', 'error');

    // Check if VALID label already exists (ignore error labels)
    const { data: existingLabel } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('shopify_order_id', body.shopify_order_id)
      .eq('organization_id', body.organization_id)
      .neq('status', 'error')
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

    // Determine carrier using business rules
    let selectedCarrier = body.preferred_carrier?.toLowerCase();

    // If user didn't select a carrier, use automatic selection based on rules
    if (!selectedCarrier) {
      const isCOD = body.is_cod === true;
      selectedCarrier = selectCarrierByRules(
        body.destination_city,
        body.destination_department,
        isCOD
      );
      console.log(`🚚 Auto-selected carrier: ${selectedCarrier}`);
    } else {
      console.log(`🚚 User-selected carrier: ${selectedCarrier}`);
    }

    const carrierConfig = COLOMBIA_CARRIERS[selectedCarrier] || COLOMBIA_CARRIERS['coordinadora'];
    console.log(`🚚 Selected carrier: ${carrierConfig.carrier}, service: ${carrierConfig.service}`);

    // Get state code for the destination department (supports both Shopify codes and names)
    const stateCode = getStateCode(body.destination_department);
    console.log(`📍 Department "${body.destination_department}" -> State code "${stateCode}"`);

    // Parse address to extract street and number
    const { street, number } = parseAddress(body.destination_address);
    console.log(`📍 Parsed address - Street: "${street}", Number: "${number}"`);

    // Extract district/neighborhood from address
    const district = extractDistrict(body.destination_address, body.destination_city);
    console.log(`📍 District: "${district}"`);

    // Clean phone number (remove non-numeric characters except +)
    const cleanPhone = (body.recipient_phone || "3000000000").replace(/[^0-9+]/g, '');

    // ============= COLOMBIA ADDRESS FORMAT FOR ENVIA.COM =============
    // Envia.com (CO) expects:
    // - state: 2-letter department code (e.g., DC, AN, CN)
    // - city: City NAME (e.g., "Bogota", "Medellin")
    // - postalCode: Real postal code (e.g., "111321", "050001")

    // Use DANE code for destination city and postalCode
    const destDaneCode = getDaneCode(body.destination_city, body.destination_department);

    // For Inter Rapidísimo, use addressId + basic fields WITHOUT taxIdentification
    // This avoids "Identification numbers are required" error for COD shipments
    // The addressId references pre-registered address with valid identification data
    const isInterRapidisimo = carrierConfig.carrier === 'interrapidisimo';

    // Envia requires origin.street + origin.number; DOSMICOS_ORIGIN.street includes "#" so we extract the number.
    const { street: originStreet, number: originNumber } = parseAddress(DOSMICOS_ORIGIN.street);

    const originData = isInterRapidisimo
      ? {
          addressId: DOSMICOS_ORIGIN.addressId,
          name: DOSMICOS_ORIGIN.name,
          company: DOSMICOS_ORIGIN.company,
          email: DOSMICOS_ORIGIN.email,
          phone: DOSMICOS_ORIGIN.phone,
          street: originStreet,
          number: originNumber,
          district: DOSMICOS_ORIGIN.district,
          city: DOSMICOS_ORIGIN.city,
          state: DOSMICOS_ORIGIN.state,
          country: DOSMICOS_ORIGIN.country,
          postalCode: DOSMICOS_ORIGIN.postalCode,
          reference: DOSMICOS_ORIGIN.reference,
          taxIdentification: DOSMICOS_ORIGIN.taxIdentification, // Include NIT for Inter Rapidísimo
        }
      : DOSMICOS_ORIGIN; // Full data including taxIdentification for other carriers

    console.log(`📍 Origin mode: ${isInterRapidisimo ? 'addressId + full fields (with taxIdentification)' : 'full address data'}`);
    console.log(`📍 Destination (CO): state="${stateCode}", city(DANE)="${destDaneCode}"`);
    console.log(`📤 Origin address:`, originData);

    // Build reference text with address2 (apartment/tower info) + order number
    const referenceText = [
      body.destination_address2,  // "Apto 1133 torre 9 villa de los Angeles 2"
      `Pedido #${body.order_number}`
    ].filter(Boolean).join(' - ');

    // Build destination - use DANE code for both city and postalCode
    const destinationData: Record<string, any> = {
      name: body.recipient_name || "Cliente",
      company: "",
      email: body.recipient_email || "cliente@dosmicos.co",
      phone: cleanPhone,
      street: street,
      number: number,
      district: district,
      city: destDaneCode,
      state: stateCode,
      country: "CO",
      postalCode: destDaneCode,
      reference: referenceText,
      taxIdentification: "0000000000"
    };

    console.log(`📤 Destination address:`, destinationData);
    const enviaRequest: Record<string, any> = {
      origin: originData,
      destination: destinationData,
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
        service: (body as any).preferred_service || carrierConfig.service,
        type: (body as any).delivery_type === 'oficina' ? 2 : 1
      },
      settings: {
        printFormat: "PDF",
        printSize: "STOCK_4X6",
        currency: "COP",
        comments: `Pedido Dosmicos #${body.order_number}${body.is_cod ? ' - CONTRAENTREGA' : ''}`
      }
    };

    // Add Cash on Delivery (COD) if specified - try multiple formats
    if (body.is_cod && body.cod_amount && body.cod_amount > 0) {
      console.log(`💵 COD enabled: ${body.cod_amount} COP`);
      console.log(`💵 COD detection - is_cod: ${body.is_cod}, cod_amount: ${body.cod_amount}`);
      
      // Format 1: In shipment object (standard format)
      enviaRequest.shipment.cashOnDelivery = body.cod_amount;
      
      // Format 2: In settings object (alternative format)
      enviaRequest.settings.cashOnDelivery = body.cod_amount;
      
      // Format 3: As additional service with object format
      enviaRequest.settings.additionalServices = {
        cashOnDelivery: {
          amount: body.cod_amount,
          currency: "COP"
        }
      };
      
      // Format 4: Direct in root (some APIs expect this)
      enviaRequest.cashOnDelivery = body.cod_amount;
      
      console.log(`💵 COD added in multiple formats: shipment.cashOnDelivery, settings.cashOnDelivery, settings.additionalServices.cashOnDelivery, root.cashOnDelivery`);
    } else {
      console.log(`💵 COD NOT enabled - is_cod: ${body.is_cod}, cod_amount: ${body.cod_amount}`);
    }

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

    // Log COD-related data in response for debugging
    console.log('📥 COD Response Analysis:', JSON.stringify({
      hasCashOnDelivery: !!shipmentData.cashOnDelivery,
      cashOnDeliveryValue: shipmentData.cashOnDelivery,
      additionalServices: shipmentData.additionalServices,
      codInfo: shipmentData.codInfo,
      amountToCollect: shipmentData.amountToCollect,
      collectAmount: shipmentData.collectAmount,
      allKeys: Object.keys(shipmentData)
    }, null, 2));

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
      raw_response: enviaData,
      // Store COD info for debugging
      cod_requested: body.is_cod,
      cod_amount_requested: body.cod_amount
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

    // === AUTO-FULFILL IN SHOPIFY ===
    const SHOPIFY_STORE_DOMAIN = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    
    if (SHOPIFY_STORE_DOMAIN && SHOPIFY_ACCESS_TOKEN && body.shopify_order_id) {
      try {
        console.log('📦 Creating Shopify fulfillment for order:', body.shopify_order_id);
        
        // Map carrier names for Shopify
        const carrierNamesMap: Record<string, string> = {
          'coordinadora': 'Coordinadora Mercantil',
          'interrapidisimo': 'Inter Rapidísimo',
          'deprisa': 'Deprisa',
          'servientrega': 'Servientrega',
          'tcc': 'TCC',
          'envia': 'Envia'
        };
        
        const trackingCompany = carrierNamesMap[carrierConfig.carrier.toLowerCase()] || carrierConfig.carrier;
        
        // Create fulfillment in Shopify
        const fulfillmentResponse = await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${body.shopify_order_id}/fulfillments.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fulfillment: {
                tracking_number: shipmentData.trackingNumber,
                tracking_company: trackingCompany,
                notify_customer: true
              }
            })
          }
        );
        
        const fulfillmentData = await fulfillmentResponse.json();
        
        if (fulfillmentResponse.ok) {
          console.log('✅ Shopify fulfillment created successfully');
          
          // Update picking_packing_orders to 'shipped'
          const { error: pickingError } = await supabase
            .from('picking_packing_orders')
            .update({ 
              operational_status: 'shipped',
              shipped_at: new Date().toISOString()
            })
            .eq('shopify_order_id', body.shopify_order_id);
          
          if (pickingError) {
            console.error('⚠️ Error updating picking_packing_orders:', pickingError);
          } else {
            console.log('✅ picking_packing_orders updated to shipped');
          }
          
          // Update shopify_orders fulfillment_status
          const { error: shopifyError } = await supabase
            .from('shopify_orders')
            .update({ fulfillment_status: 'fulfilled' })
            .eq('shopify_order_id', body.shopify_order_id);
          
          if (shopifyError) {
            console.error('⚠️ Error updating shopify_orders:', shopifyError);
          } else {
            console.log('✅ shopify_orders updated to fulfilled');
          }
        } else {
          console.error('⚠️ Shopify fulfillment failed:', fulfillmentData);
        }
      } catch (fulfillmentError) {
        console.error('⚠️ Error creating Shopify fulfillment:', fulfillmentError);
        // Don't fail the whole request - label was created successfully
      }
    }

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
