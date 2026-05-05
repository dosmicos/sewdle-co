import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lookupDaneCode } from "../_shared/dane-codes.ts";

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

// Normalize text for comparison (removes accents and lowercases)
function normalizeForComparison(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Use AI (OpenAI) to resolve ambiguous municipality matches
async function resolveWithAI(
  city: string,
  department: string | undefined,
  candidates: { municipality: string; department: string; dane_code: string }[]
): Promise<{ municipality: string; department: string; dane_code: string } | null> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    console.log('⚠️ No OPENAI_API_KEY configured, skipping AI resolution');
    return null;
  }

  const candidateList = candidates
    .map((c, i) => `${i + 1}. ${c.municipality}, ${c.department} (DANE: ${c.dane_code})`)
    .join('\n');

  const prompt = `El cliente escribió esta dirección de envío en Colombia:
- Ciudad: "${city}"
- Departamento: "${department || 'no especificado'}"

Hay varios municipios con nombres similares. ¿Cuál es el correcto?

${candidateList}

Responde SOLO con el número de la opción correcta (1, 2, 3, etc). Si no estás seguro, responde "0".`;

  try {
    console.log(`🤖 Calling AI to disambiguate "${city}" among ${candidates.length} candidates...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('❌ AI API error:', response.status);
      return null;
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim();
    console.log(`🤖 AI answered: "${answer}"`);

    const index = parseInt(answer, 10);
    if (index > 0 && index <= candidates.length) {
      const selected = candidates[index - 1];
      console.log(`✅ AI resolved: "${city}" → ${selected.municipality}, ${selected.department}`);
      return selected;
    }

    console.log('⚠️ AI could not determine the correct municipality');
    return null;
  } catch (err) {
    console.error('❌ AI resolution error:', err);
    return null;
  }
}

// 3-layer DANE code lookup:
// 1. Exact match (using pre-normalized column in DB)
// 2. Fuzzy match with Levenshtein distance (ignoring department for flexibility)
// 3. AI disambiguation for ambiguous cases
// 4. Fallback to Envia Queries API
async function getDaneCodeFromDB(
  supabase: any,
  city: string,
  department: string | undefined,
  organizationId: string,
  enviaApiKey: string
): Promise<{ daneCode: string; source: string } | null> {

  const normalizedCity = normalizeForComparison(city);
  const normalizedDept = department ? normalizeForComparison(department) : null;

  console.log(`🔍 DANE lookup: city="${city}" (norm: "${normalizedCity}"), dept="${department}" (norm: "${normalizedDept}")`);

  // ============= LAYER 0: Embedded DANE map (instant, no DB) =============
  const embeddedResult = lookupDaneCode(city, department);
  if (embeddedResult) {
    console.log(`✅ DANE found (embedded map, ${embeddedResult.source}): "${city}" → "${embeddedResult.daneCode}" (${embeddedResult.municipality}, ${embeddedResult.department})`);
    return { daneCode: embeddedResult.daneCode, source: `embedded_${embeddedResult.source}` };
  }
  console.log(`⚠️ Not in embedded map, trying DB...`);

  // ============= LAYER 1: Exact match using normalized column =============
  // Search by city only (ignore department) — handles "Chía" + dept "Bogotá" → finds Chía, Cundinamarca
  let exactMatches: any[] | null = null;
  let exactErr: any = null;

  // Try normalized column first (fast, indexed)
  const normResult = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department')
    .eq('organization_id', organizationId)
    .eq('municipality_normalized', normalizedCity);

  if (normResult.error) {
    console.log('⚠️ municipality_normalized not available, falling back to ilike');
    const fallbackResult = await supabase
      .from('shipping_coverage')
      .select('dane_code, municipality, department')
      .eq('organization_id', organizationId)
      .ilike('municipality', city.trim());
    exactMatches = fallbackResult.data;
    exactErr = fallbackResult.error;
  } else {
    exactMatches = normResult.data;
    exactErr = normResult.error;
  }

  if (exactErr) {
    console.error('❌ Error in DANE lookup:', exactErr);
  }

  if (exactMatches && exactMatches.length === 1) {
    // Unique match — perfect
    console.log(`✅ DANE found (exact, unique): "${city}" → "${exactMatches[0].dane_code}" (${exactMatches[0].municipality}, ${exactMatches[0].department})`);
    return { daneCode: exactMatches[0].dane_code, source: 'db_exact' };
  }

  if (exactMatches && exactMatches.length > 1) {
    // Multiple matches (duplicate municipality names) — try department to disambiguate
    console.log(`📊 Found ${exactMatches.length} exact matches for "${city}", using department to disambiguate...`);

    if (normalizedDept) {
      const deptMatch = exactMatches.find((r: any) =>
        normalizeForComparison(r.department) === normalizedDept ||
        normalizeForComparison(r.department).includes(normalizedDept) ||
        normalizedDept.includes(normalizeForComparison(r.department))
      );
      if (deptMatch) {
        console.log(`✅ DANE found (exact + dept match): "${city}" → "${deptMatch.dane_code}" (${deptMatch.municipality}, ${deptMatch.department})`);
        return { daneCode: deptMatch.dane_code, source: 'db_exact_dept' };
      }
    }

    // Department didn't help — try AI
    const aiResult = await resolveWithAI(city, department, exactMatches);
    if (aiResult?.dane_code) {
      console.log(`✅ DANE found (AI disambiguated): "${city}" → "${aiResult.dane_code}" (${aiResult.municipality}, ${aiResult.department})`);
      return { daneCode: aiResult.dane_code, source: 'ai_disambiguation' };
    }

    // Last resort: return first match
    console.log(`⚠️ Could not disambiguate, using first match: ${exactMatches[0].municipality}, ${exactMatches[0].department}`);
    return { daneCode: exactMatches[0].dane_code, source: 'db_exact_first' };
  }

  // ============= LAYER 2: Fuzzy match with Levenshtein =============
  // Fetch all municipalities for this org and find closest match
  console.log(`🔄 No exact match, trying fuzzy matching for "${city}"...`);

  const { data: allMunicipalities, error: fuzzyErr } = await supabase
    .from('shipping_coverage')
    .select('dane_code, municipality, department, municipality_normalized')
    .eq('organization_id', organizationId);

  if (fuzzyErr) {
    console.error('❌ Error fetching municipalities for fuzzy match:', fuzzyErr);
  }

  // Auto-seed DANE data if table is empty for this org
  if (!allMunicipalities || allMunicipalities.length === 0) {
    console.log(`⚠️ No municipalities found for org ${organizationId}, auto-seeding DANE data...`);
    try {
      const { error: seedErr } = await supabase.rpc('seed_dane_municipalities', { target_org_id: organizationId });
      if (seedErr) {
        console.error('❌ Auto-seed error:', seedErr);
      } else {
        console.log('✅ Auto-seed complete, retrying lookup...');
        // Retry the exact match after seeding
        const retryResult = await supabase
          .from('shipping_coverage')
          .select('dane_code, municipality, department')
          .eq('organization_id', organizationId)
          .eq('municipality_normalized', normalizedCity);
        if (retryResult.data && retryResult.data.length > 0) {
          const match = retryResult.data.length === 1 ? retryResult.data[0] :
            (normalizedDept ? retryResult.data.find((r: any) =>
              normalizeForComparison(r.department).includes(normalizedDept) || normalizedDept.includes(normalizeForComparison(r.department))
            ) : null) || retryResult.data[0];
          console.log(`✅ DANE found after auto-seed: "${city}" → "${match.dane_code}" (${match.municipality}, ${match.department})`);
          return { daneCode: match.dane_code, source: 'db_auto_seeded' };
        }
      }
    } catch (seedError) {
      console.error('❌ Auto-seed exception:', seedError);
    }
  }

  if (allMunicipalities && allMunicipalities.length > 0) {
    // Dynamic threshold: shorter inputs get tighter threshold to avoid absurd matches
    const maxFuzzyDistance = Math.max(1, Math.min(3, Math.floor(normalizedCity.length * 0.4)));
    console.log(`🔄 Fuzzy threshold for "${normalizedCity}" (${normalizedCity.length} chars): max distance = ${maxFuzzyDistance}`);

    // Calculate Levenshtein distance for each municipality
    const scored = allMunicipalities
      .map((row: any) => ({
        ...row,
        distance: levenshtein(normalizedCity, row.municipality_normalized || normalizeForComparison(row.municipality))
      }))
      .filter((row: any) => row.distance <= maxFuzzyDistance)
      .sort((a: any, b: any) => a.distance - b.distance);

    if (scored.length > 0) {
      const bestDistance = scored[0].distance;
      const bestMatches = scored.filter((r: any) => r.distance === bestDistance);

      console.log(`📊 Fuzzy: ${scored.length} matches within distance 3, best distance: ${bestDistance}, ${bestMatches.length} tied`);

      if (bestMatches.length === 1) {
        // Single best fuzzy match
        console.log(`✅ DANE found (fuzzy, distance=${bestDistance}): "${city}" → "${bestMatches[0].dane_code}" (${bestMatches[0].municipality}, ${bestMatches[0].department})`);
        return { daneCode: bestMatches[0].dane_code, source: `db_fuzzy_d${bestDistance}` };
      }

      // Multiple tied fuzzy matches — try department
      if (normalizedDept) {
        const deptMatch = bestMatches.find((r: any) =>
          normalizeForComparison(r.department) === normalizedDept ||
          normalizeForComparison(r.department).includes(normalizedDept) ||
          normalizedDept.includes(normalizeForComparison(r.department))
        );
        if (deptMatch) {
          console.log(`✅ DANE found (fuzzy + dept, distance=${bestDistance}): "${city}" → "${deptMatch.dane_code}" (${deptMatch.municipality}, ${deptMatch.department})`);
          return { daneCode: deptMatch.dane_code, source: `db_fuzzy_dept_d${bestDistance}` };
        }
      }

      // Multiple tied, department didn't help — try AI
      const aiResult = await resolveWithAI(city, department, bestMatches);
      if (aiResult?.dane_code) {
        console.log(`✅ DANE found (fuzzy + AI, distance=${bestDistance}): "${city}" → "${aiResult.dane_code}" (${aiResult.municipality}, ${aiResult.department})`);
        return { daneCode: aiResult.dane_code, source: `ai_fuzzy_d${bestDistance}` };
      }

      // Fallback to first fuzzy match
      console.log(`⚠️ Using first fuzzy match: ${bestMatches[0].municipality}, ${bestMatches[0].department}`);
      return { daneCode: bestMatches[0].dane_code, source: `db_fuzzy_first_d${bestDistance}` };
    }
  }

  // ============= LAYER 3: Fallback to Envia Queries API =============
  console.log(`🔄 No fuzzy match, falling back to Envia Queries API for "${city}"...`);
  const enviaLookup = await lookupEnviaCity('CO', city, enviaApiKey);

  if (enviaLookup?.zipCode && /^\d{5,8}$/.test(enviaLookup.zipCode)) {
    console.log(`✅ DANE from Envia API: "${city}" → "${enviaLookup.zipCode}"`);

    // Cache for future use
    try {
      await supabase
        .from('shipping_coverage')
        .insert({
          organization_id: organizationId,
          municipality: city,
          department: department || enviaLookup.state || 'Unknown',
          dane_code: enviaLookup.zipCode,
        });
      console.log(`💾 Cached DANE for "${city}" in shipping_coverage`);
    } catch (cacheError) {
      console.log(`⚠️ Cache error (non-critical):`, cacheError);
    }

    return { daneCode: enviaLookup.zipCode, source: 'envia_api' };
  }

  // No DANE found anywhere
  console.error(`❌ NO DANE CODE FOUND for city: "${city}" (dept: ${department || 'unknown'})`);
  return null;
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
// Preserves the original separator (# or no/No/N°/num)
function parseAddress(address: string): { street: string; number: string } {
  // Pattern 1: Uses # (e.g., "Calle 167 # 51 A - 41")
  const patternHash = /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s*[#]\s*(.+)$/i;
  
  // Pattern 2: Uses no/No/N°/num (e.g., "Cra 8 no 67-10") - CAPTURA EL SEPARADOR
  const patternNo = /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s*(no\.?|n°|num\.?)\s*(.+)$/i;
  
  // Pattern 3: No separator (e.g., "Cra 27 63B-61")
  const patternNoSep = /^((?:cra|carrera|calle|cl|av|avenida|diag|diagonal|trans|transversal|kr|k)\s*\.?\s*\d+[a-z]?)\s+(\d+.*)$/i;

  // Check pattern 1 (with #)
  let match = address.match(patternHash);
  if (match) {
    const street = match[1].trim();
    const number = `# ${match[2].trim()}`;
    console.log(`📍 Address parsed (with #): street="${street}", number="${number}"`);
    return { street, number };
  }
  
  // Check pattern 2 (with no/No/n°/num) - preserva el separador original
  match = address.match(patternNo);
  if (match) {
    const street = match[1].trim();
    const separator = match[2].replace('.', ''); // "no", "n°", "num" (sin punto)
    const number = `${separator} ${match[3].trim()}`;
    console.log(`📍 Address parsed (with ${separator}): street="${street}", number="${number}"`);
    return { street, number };
  }
  
  // Check pattern 3 (no separator - default to #)
  match = address.match(patternNoSep);
  if (match) {
    const street = match[1].trim();
    const number = `# ${match[2].trim()}`;
    console.log(`📍 Address parsed (no separator, using #): street="${street}", number="${number}"`);
    return { street, number };
  }
  
  // Fallback: use entire address as street
  console.log(`📍 Address fallback (no pattern matched): "${address}"`);
  return {
    street: address,
    number: ""
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
  addressId: 6289477,
  name: "Julian Castro",
  company: "dosmicos sas",
  email: "dosmicoscol@gmail.com",
  phone: "3125456340",
  street: "Cra 27 63b -61",
  city: "11001000",        // Código DANE 8 dígitos para Bogotá
  state: "DC",
  country: "CO",
  postalCode: "11001000",  // Código DANE 8 dígitos
  reference: "Barrio quinta Mutis CASA 1er piso de rejas negras",
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
  'coordinadora': { carrier: 'coordinadora', service: 'ecommerce' },
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

// normalizeForComparison is defined earlier in the file (line ~83)
// This normalizeText is kept for backward compatibility with selectCarrierByRules
function normalizeText(text: string): string {
  return normalizeForComparison(text);
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

  // Rule 2.5: Manizales, Caldas → Coordinadora (accepts both COD and paid)
  if (normalizedDept.includes('caldas') && normalizedCity.includes('manizales')) {
    console.log('📍 Rule 2.5: Manizales, Caldas → Coordinadora (acepta COD y pagado)');
    return 'coordinadora';
  }

  // Rule 2.6: Tunja, Boyacá → Coordinadora (accepts both COD and paid)
  if (normalizedDept.includes('boyaca') && normalizedCity.includes('tunja')) {
    console.log('📍 Rule 2.6: Tunja, Boyacá → Coordinadora (acepta COD y pagado)');
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

    // Check if VALID label already exists (ignore error and cancelled labels)
    const { data: existingLabel } = await supabase
      .from('shipping_labels')
      .select('*')
      .eq('shopify_order_id', body.shopify_order_id)
      .eq('organization_id', body.organization_id)
      .neq('status', 'error')
      .neq('status', 'cancelled')
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

    // ============= GET DANE CODE (accent-insensitive with fallback) =============
    // Use the new normalized lookup that handles accents properly
    console.log(`🔍 Looking up DANE for: ${body.destination_city}, ${body.destination_department}`);
    
    const daneResult = await getDaneCodeFromDB(
      supabase, 
      body.destination_city, 
      body.destination_department, 
      body.organization_id,
      ENVIA_API_KEY
    );
    
    if (!daneResult) {
      // Return controlled error with 200 so frontend can display proper message
      console.error(`❌ DANE not found for "${body.destination_city}", returning controlled error`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No se encontró el código DANE para la ciudad "${body.destination_city}"${body.destination_department ? ` en ${body.destination_department}` : ''}. Por favor contacte soporte para agregar esta ciudad al sistema.`,
          errorCode: 'DANE_NOT_FOUND'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const destDaneCode = daneResult.daneCode;
    console.log(`✅ DANE resolved: ${destDaneCode} (source: ${daneResult.source})`);

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
    
    // Clean identification number: ONLY numeric characters, no + or country prefix
    let cleanIdentification = (body.recipient_phone || "1234567890").replace(/[^0-9]/g, '');
    // If starts with 57 and is longer than 10 digits, remove the country prefix
    if (cleanIdentification.startsWith('57') && cleanIdentification.length > 10) {
      cleanIdentification = cleanIdentification.substring(2);
    }

    // ============= COLOMBIA ADDRESS FORMAT FOR ENVIA.COM =============
    // Envia.com (CO) expects:
    // - state: 2-letter department code (e.g., DC, AN, CN)
    // - city: DANE code (e.g., "05001000" for Medellín)
    // - postalCode: DANE code

    // For Inter Rapidísimo, use addressId + basic fields WITHOUT taxIdentification
    // This avoids "Identification numbers are required" error for COD shipments
    // The addressId references pre-registered address with valid identification data
    const isInterRapidisimo = carrierConfig.carrier === 'interrapidisimo';

    // Full origin data for ALL carriers
    const originData = {
      address_id: 6289477,
      name: `${body.order_number} - Dosmicos sas`,
      company: DOSMICOS_ORIGIN.company,
      email: DOSMICOS_ORIGIN.email,
      phone: DOSMICOS_ORIGIN.phone,
      street: "Cra 27 63b -61",
      number: "",
      city: DOSMICOS_ORIGIN.city,
      state: DOSMICOS_ORIGIN.state,
      country: DOSMICOS_ORIGIN.country,
      postalCode: DOSMICOS_ORIGIN.postalCode,
      reference: DOSMICOS_ORIGIN.reference,
      identification_number: "901412407",
    };

    console.log(`📍 Origin mode: full address data for all carriers`);
    console.log(`📍 Destination (CO): state="${stateCode}", city(DANE)="${destDaneCode}"`);
    console.log(`📤 Origin address:`, originData);

    // Build reference text: ONLY address2 for maximum observation space
    // Order number now appears in sender name: "Dosmicos #65490"
    const referenceText = (body.destination_address2 || '').trim().replace(/\s+/g, ' ').substring(0, 100);

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
    };

    // Add identificationNumber: use cleaned phone (only digits, no +57) for Inter Rapidísimo
    if (isInterRapidisimo) {
      // Inter Rapidísimo requires valid identification - use customer phone (10 digits) or DANE as fallback
      destinationData.identificationNumber = cleanIdentification || destDaneCode;
      destinationData.identificationType = "CC"; // Cédula de ciudadanía - required for Inter Rapidísimo
      console.log(`📋 Inter Rapidísimo identification: ${cleanIdentification}`);
    } else {
      destinationData.identificationNumber = "0000000000";
    }

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
        order_id: String(body.order_number),
        comments: `Pedido Dosmicos #${body.order_number}${body.is_cod ? ' - CONTRAENTREGA' : ''}`
      }
    };

    // Add Cash on Delivery (COD) as additionalServices in package (per Envia.com docs)
    if (body.is_cod && body.cod_amount && body.cod_amount > 0) {
      console.log(`💵 COD enabled: ${body.cod_amount} COP`);
      
      // Add additionalServices to the package (correct format per Envia.com docs)
      enviaRequest.packages[0].additionalServices = [
        {
          data: {
            amount: body.cod_amount
          },
          service: "cash_on_delivery"
        }
      ];
      
      console.log(`💵 COD added to packages[0].additionalServices`);
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
      
      // Detectar errores de zonas de difícil acceso
      const errorMsgLower = errorMsg.toLowerCase();
      const isDifficultAccessError = 
        errorMsgLower.includes('difícil acceso') ||
        errorMsgLower.includes('dificil acceso') ||
        errorMsgLower.includes('zonas de dificil') ||
        errorMsgLower.includes('reclamo en oficina') ||
        (errorMsgLower.includes('service provided not available') && errorMsgLower.includes('incorrect'));
      
      if (isDifficultAccessError) {
        console.log('⚠️ Detected difficult access zone error');
      }
      
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
        JSON.stringify({ 
          success: false, 
          error: errorMsg,
          errorCode: isDifficultAccessError ? 'DIFFICULT_ACCESS_ZONE' : undefined
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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

    // === RESPOND IMMEDIATELY — Shopify fulfillment runs in background ===
    // The label is created and saved. User sees the label right away.
    // Shopify fulfillment + DB updates happen async (saves 2-8 seconds).

    if (body.shopify_order_id && body.organization_id) {
      // Fire and forget — do NOT await this
      (async () => {
        try {
          console.log('📦 [BACKGROUND] Starting Shopify fulfillment...');

          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('shopify_store_url, shopify_credentials')
            .eq('id', body.organization_id)
            .single();

          if (orgError || !org?.shopify_store_url || !org?.shopify_credentials) {
            console.log('⚠️ [BACKGROUND] Skipping fulfillment:', orgError?.message || 'No Shopify config');
            return;
          }

          const credentials = org.shopify_credentials as { access_token?: string };
          const accessToken = credentials.access_token;
          if (!accessToken) {
            console.log('⚠️ [BACKGROUND] No Shopify access token');
            return;
          }

          let shopDomain = org.shopify_store_url
            .replace('https://', '').replace('http://', '').replace(/\/$/, '');
          if (!shopDomain.includes('.myshopify.com')) {
            shopDomain = `${shopDomain}.myshopify.com`;
          }

          const carrierNamesMap: Record<string, string> = {
            'coordinadora': 'Coordinadora Mercantil',
            'interrapidisimo': 'Inter Rapidísimo',
            'deprisa': 'Deprisa',
            'servientrega': 'Servientrega',
            'tcc': 'TCC',
            'envia': 'Envia'
          };
          const trackingCompany = carrierNamesMap[carrierConfig.carrier.toLowerCase()] || carrierConfig.carrier;

          // Retry logic (up to 3 attempts, 500ms between)
          let shopifyFulfillmentId: string | null = null;
          let shopifyFulfillmentStatus = 'pending';
          let shopifyFulfillmentError: string | null = null;

          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const foResponse = await fetch(
                `https://${shopDomain}/admin/api/2024-01/orders/${body.shopify_order_id}/fulfillment_orders.json`,
                { headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' } }
              );
              const foData = await foResponse.json();

              if (!foResponse.ok) {
                shopifyFulfillmentStatus = 'failed';
                shopifyFulfillmentError = JSON.stringify(foData.errors || foData);
                continue;
              }

              const openFO = (foData.fulfillment_orders || []).find(
                (fo: any) => fo.status === 'open' || fo.status === 'in_progress'
              );

              if (!openFO) {
                shopifyFulfillmentStatus = 'skipped';
                shopifyFulfillmentError = 'No open fulfillment orders';
                break;
              }

              const fResponse = await fetch(
                `https://${shopDomain}/admin/api/2024-01/fulfillments.json`,
                {
                  method: 'POST',
                  headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fulfillment: {
                      line_items_by_fulfillment_order: [{ fulfillment_order_id: openFO.id }],
                      tracking_info: {
                        company: trackingCompany,
                        number: shipmentData.trackingNumber,
                        url: `https://envia.com/es-CO/tracking?label=${shipmentData.trackingNumber}`
                      },
                      notify_customer: true
                    }
                  })
                }
              );
              const fData = await fResponse.json();

              if (fResponse.ok && fData.fulfillment?.id) {
                shopifyFulfillmentId = String(fData.fulfillment.id);
                shopifyFulfillmentStatus = 'success';
                console.log('✅ [BACKGROUND] Shopify fulfillment created:', shopifyFulfillmentId);
                break;
              } else {
                shopifyFulfillmentStatus = 'failed';
                shopifyFulfillmentError = JSON.stringify(fData.errors || fData);
              }
            } catch (retryErr: any) {
              shopifyFulfillmentStatus = 'failed';
              shopifyFulfillmentError = retryErr.message;
            }

            if (attempt < 3 && shopifyFulfillmentStatus === 'failed') {
              await new Promise(r => setTimeout(r, 500));
            }
          }

          // Update local DB in parallel
          await Promise.all([
            supabase.from('picking_packing_orders')
              .update({ operational_status: 'shipped', shipped_at: new Date().toISOString() })
              .eq('shopify_order_id', body.shopify_order_id),
            supabase.from('shopify_orders')
              .update({ fulfillment_status: 'fulfilled' })
              .eq('shopify_order_id', body.shopify_order_id),
            savedLabel?.id ? supabase.from('shipping_labels')
              .update({
                shopify_fulfillment_id: shopifyFulfillmentId,
                shopify_fulfillment_status: shopifyFulfillmentStatus,
                shopify_fulfillment_error: shopifyFulfillmentError
              })
              .eq('id', savedLabel.id) : Promise.resolve()
          ]);

          console.log('✅ [BACKGROUND] Fulfillment complete:', shopifyFulfillmentStatus);
        } catch (bgError: any) {
          console.error('❌ [BACKGROUND] Fulfillment error:', bgError.message);
        }
      })().catch(err => console.error('❌ [BACKGROUND] Unhandled:', err));
    }

    // Return immediately — user sees label without waiting for Shopify
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
