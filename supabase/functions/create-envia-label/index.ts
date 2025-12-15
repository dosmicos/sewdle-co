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

// Colombia POSTAL CODES - Real postal codes for Envia.com API
// Envia.com requires actual postal codes, not DANE codes
const COLOMBIA_POSTAL_CODES: Record<string, string> = {
  // Bogotá D.C.
  'bogota': '111321',
  // Antioquia
  'medellin': '050001',
  'envigado': '055422',
  'sabaneta': '055450',
  'itagui': '055412',
  'bello': '051050',
  'rionegro': '054040',
  'la estrella': '055460',
  'caldas': '055440',
  'copacabana': '051040',
  'girardota': '051020',
  'barbosa': '051030',
  // Valle del Cauca
  'cali': '760001',
  'palmira': '763531',
  'buenaventura': '764501',
  'tulua': '763021',
  'buga': '763041',
  'cartago': '762021',
  'yumbo': '760501',
  // Atlántico
  'barranquilla': '080001',
  'soledad': '083001',
  'malambo': '083501',
  // Bolívar
  'cartagena': '130001',
  'turbaco': '131001',
  'magangue': '132001',
  // Santander
  'bucaramanga': '680001',
  'floridablanca': '681001',
  'giron': '681501',
  'piedecuesta': '682001',
  'barrancabermeja': '687001',
  // Norte de Santander
  'cucuta': '540001',
  'villa del rosario': '541001',
  'los patios': '541501',
  // Risaralda
  'pereira': '660001',
  'dosquebradas': '661001',
  'santa rosa de cabal': '661501',
  // Caldas
  'manizales': '170001',
  'villamaria': '171001',
  // Tolima
  'ibague': '730001',
  'espinal': '733501',
  // Magdalena
  'santa marta': '470001',
  'cienaga': '472001',
  // Córdoba
  'monteria': '230001',
  'cerete': '231001',
  // Meta
  'villavicencio': '500001',
  'acacias': '507001',
  // Nariño
  'pasto': '520001',
  'tumaco': '528501',
  'ipiales': '524060',
  // Huila
  'neiva': '410001',
  'pitalito': '417030',
  // Quindío
  'armenia': '630001',
  'calarca': '632001',
  // Cauca
  'popayan': '190001',
  'santander de quilichao': '191030',
  // Sucre
  'sincelejo': '700001',
  'corozal': '702001',
  // Cesar
  'valledupar': '200001',
  'aguachica': '205001',
  // Boyacá
  'tunja': '150001',
  'duitama': '152001',
  'sogamoso': '153001',
  // Caquetá
  'florencia': '180001',
  // La Guajira
  'riohacha': '440001',
  'maicao': '442001',
  // Chocó
  'quibdo': '270001',
  // Casanare
  'yopal': '850001',
  'aguazul': '851001',
  // Putumayo
  'mocoa': '860001',
  // Amazonas
  'leticia': '910001',
  // Guainía
  'inirida': '940001',
  // Vaupés
  'mitu': '970001',
  // Vichada
  'puerto carreno': '990001',
  // Guaviare
  'san jose del guaviare': '950001',
  // Arauca
  'arauca': '810001',
  // Cundinamarca (municipalities near Bogotá)
  'soacha': '250051',
  'chia': '250001',
  'zipaquira': '250251',
  'facatativa': '253051',
  'madrid': '250551',
  'funza': '250021',
  'mosquera': '250471',
  'cajica': '250241',
  'cota': '250801',
  'la calera': '250051',
  'fusagasuga': '252211',
  'girardot': '252431',
  'tocancipa': '251811',
  'sopo': '251801',
  'tabio': '250871',
  'tenjo': '250881',
  'sibate': '250741',
  'silvania': '250751',
  'villeta': '253461'
};

// Get postal code for a city
function getPostalCode(city: string, department?: string): string {
  const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Direct match
  if (COLOMBIA_POSTAL_CODES[normalizedCity]) {
    return COLOMBIA_POSTAL_CODES[normalizedCity];
  }
  
  // Partial match
  for (const [cityKey, postalCode] of Object.entries(COLOMBIA_POSTAL_CODES)) {
    if (normalizedCity.includes(cityKey) || cityKey.includes(normalizedCity)) {
      console.log(`📮 Postal code match: "${city}" → "${postalCode}"`);
      return postalCode;
    }
  }
  
  console.log(`⚠️ No postal code found for city: "${city}", using default`);
  // Return a generic postal code based on department if available
  if (department) {
    const normalizedDept = department.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (normalizedDept.includes('bogota') || normalizedDept === 'dc') return '111321';
    if (normalizedDept.includes('antioquia')) return '050001';
    if (normalizedDept.includes('valle')) return '760001';
    if (normalizedDept.includes('atlantico')) return '080001';
    if (normalizedDept.includes('bolivar')) return '130001';
    if (normalizedDept.includes('santander') && !normalizedDept.includes('norte')) return '680001';
    if (normalizedDept.includes('norte de santander')) return '540001';
  }
  return '111321'; // Default to Bogota
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

async function lookupEnviaCity(country: string, cityName: string): Promise<EnviaCityInfo | null> {
  try {
    // Normalize city name for URL
    const normalizedCity = cityName.trim().replace(/\s+/g, '%20');
    const url = `https://queries.envia.com/locate/${country}/${normalizedCity}`;
    
    console.log(`🔍 Looking up city: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
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

// Dosmicos origin address (fixed) - will be enriched with Queries API data
const DOSMICOS_ORIGIN_BASE = {
  name: "Julian Castro",
  company: "dosmicos sas",
  email: "dosmicoscol@gmail.com",
  phone: "3125456340",
  street: "Cra 27 # 63b -61",
  number: "",
  district: "Barrio Quinta de Mutis",
  reference: "CASA 1er piso de rejas negras",
  taxIdentification: "901412407"
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

    // Get real postal codes (not DANE codes)
    const originPostalCode = '111321'; // Bogota postal code
    const destPostalCode = getPostalCode(body.destination_city, body.destination_department);

    console.log(`📍 Origin (CO): state="DC", city="Bogota", postalCode="${originPostalCode}"`);
    console.log(`📍 Destination (CO): state="${stateCode}", city="${body.destination_city}", postalCode="${destPostalCode}"`);

    // Build origin - use city NAME, not DANE code
    const originData = {
      ...DOSMICOS_ORIGIN_BASE,
      city: "Bogota",
      state: "DC",
      country: "CO",
      postalCode: originPostalCode,
    };

    console.log(`📤 Origin address:`, originData);

    // Build destination - use city NAME, not DANE code
    const destinationData: Record<string, any> = {
      name: body.recipient_name || "Cliente",
      company: "",
      email: body.recipient_email || "cliente@dosmicos.co",
      phone: cleanPhone,
      street: street,
      number: number,
      district: district,
      city: body.destination_city, // Use actual city name
      state: stateCode,
      country: "CO",
      postalCode: destPostalCode, // Use real postal code
      reference: `Pedido #${body.order_number}`,
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
        service: carrierConfig.service,
        type: 1
      },
      settings: {
        printFormat: "PDF",
        printSize: "STOCK_4X6",
        currency: "COP",
        comments: `Pedido Dosmicos #${body.order_number}${body.is_cod ? ' - CONTRAENTREGA' : ''}`
      }
    };

    // Add Cash on Delivery (COD) if specified
    if (body.is_cod && body.cod_amount && body.cod_amount > 0) {
      console.log(`💵 COD enabled: ${body.cod_amount} COP`);
      enviaRequest.shipment.cashOnDelivery = body.cod_amount;
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
