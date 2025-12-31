import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALEGRA_API_URL = "https://api.alegra.com/api/v1";

function getAlegraAuthHeader(): string {
  const email = Deno.env.get("ALEGRA_USER_EMAIL");
  const token = Deno.env.get("ALEGRA_API_TOKEN");

  if (!email || !token) {
    throw new Error("Credenciales de Alegra no configuradas");
  }

  const credentials = btoa(`${email}:${token}`);
  return `Basic ${credentials}`;
}

function normalizeWhitespace(input: unknown): string {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ");
}

function normalizeDigits(input: unknown): string {
  return String(input ?? "").replace(/\D/g, "");
}

function normalizeCOPhone(input: unknown): string {
  const digits = normalizeDigits(input);
  if (!digits) return "";
  // Colombia: guardar/normalizar a 10 dígitos; si viene con 57, tomar los últimos 10.
  if (digits.startsWith("57") && digits.length > 10) return digits.slice(-10);
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function findContactInAlegra(params: {
  phone?: unknown;
  identification?: unknown;
  email?: unknown;
}): Promise<{
  found: boolean;
  matchedBy: "identification" | "phone" | "email" | "created" | "rate_limited";
  contact: any;
  rateLimited?: boolean;
  retryAfterSec?: number;
}> {
  const phone = normalizeCOPhone(params.phone);
  const identification = normalizeDigits(params.identification);
  const email = normalizeWhitespace(params.email).toLowerCase();

  console.log("findContactInAlegra - Buscando:", { email, identification, phone });

  // Helper para detectar rate limit
  const isRateLimitError = (e: any) => {
    const msg = String(e?.message || e?.alegra?.message || "").toLowerCase();
    return msg.includes("too many requests") || msg.includes("rate limit") || e?.status === 429;
  };

  // 1) PRIMERO: Buscar por EMAIL (query directo, 1 request)
  if (email) {
    try {
      console.log("findContactInAlegra - Buscando por email:", email);
      const byEmail = await makeAlegraRequest(
        `/contacts?type=client&query=${encodeURIComponent(email)}&start=0&limit=10`
      );
      if (Array.isArray(byEmail) && byEmail.length > 0) {
        const match = byEmail.find((c: any) => 
          normalizeWhitespace(c.email).toLowerCase() === email
        );
        if (match) {
          console.log("findContactInAlegra - Encontrado por email:", match.id, match.name);
          return { found: true, matchedBy: "email", contact: match };
        }
      }
    } catch (e: any) {
      if (isRateLimitError(e)) {
        console.warn("findContactInAlegra - Rate limit en búsqueda por email");
        return { found: false, matchedBy: "rate_limited", contact: null, rateLimited: true, retryAfterSec: 20 };
      }
      console.error("findContactInAlegra - Error buscando por email:", e.message);
    }
  }

  // 2) SEGUNDO: Buscar por identificación (cédula)
  if (identification) {
    try {
      console.log("findContactInAlegra - Buscando por identificación:", identification);
      const byId = await makeAlegraRequest(
        `/contacts?type=client&identification=${encodeURIComponent(identification)}&start=0&limit=10`
      );
      if (Array.isArray(byId) && byId.length > 0) {
        console.log("findContactInAlegra - Encontrado por identificación:", byId[0].id, byId[0].name);
        return { found: true, matchedBy: "identification", contact: byId[0] };
      }
    } catch (e: any) {
      if (isRateLimitError(e)) {
        console.warn("findContactInAlegra - Rate limit en búsqueda por identificación");
        return { found: false, matchedBy: "rate_limited", contact: null, rateLimited: true, retryAfterSec: 20 };
      }
      console.error("findContactInAlegra - Error buscando por identificación:", e.message);
    }
  }

  // 3) TERCERO: Buscar por teléfono (query directo)
  if (phone) {
    try {
      // Buscar con los últimos 10 dígitos del teléfono
      const phoneDigits = phone.replace(/\D/g, '').slice(-10);
      console.log("findContactInAlegra - Buscando por teléfono:", phoneDigits);
      const byPhone = await makeAlegraRequest(
        `/contacts?type=client&query=${encodeURIComponent(phoneDigits)}&start=0&limit=10`
      );
      if (Array.isArray(byPhone) && byPhone.length > 0) {
        const match = byPhone.find((c: any) => {
          const p1 = normalizeCOPhone(c.phonePrimary);
          const p2 = normalizeCOPhone(c.mobile);
          return (p1 && p1 === phone) || (p2 && p2 === phone);
        });
        if (match) {
          console.log("findContactInAlegra - Encontrado por teléfono:", match.id, match.name);
          return { found: true, matchedBy: "phone", contact: match };
        }
      }
    } catch (e: any) {
      if (isRateLimitError(e)) {
        console.warn("findContactInAlegra - Rate limit en búsqueda por teléfono");
        return { found: false, matchedBy: "rate_limited", contact: null, rateLimited: true, retryAfterSec: 20 };
      }
      console.error("findContactInAlegra - Error buscando por teléfono:", e.message);
    }
  }

  console.log("findContactInAlegra - No se encontró cliente, se creará uno nuevo");
  return { found: false, matchedBy: "created", contact: null };
}

// Tipos de identificación válidos según documentación Alegra DIAN
const VALID_IDENTIFICATION_TYPES = ['RC', 'TI', 'CC', 'TE', 'CE', 'NIT', 'PP', 'PEP', 'DIE', 'NUIP', 'FOREIGN_NIT'];

// Diccionario de normalización de ciudades para DIAN
// Fuente: https://developer.alegra.com/reference/colombiaBF
const ALEGRA_CITY_NORMALIZATIONS: Record<string, { city: string; department: string }> = {
  // Bogotá variaciones
  'bogota': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogota dc': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogota d.c.': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogota d.c': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá dc': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá d.c.': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  'bogotá d.c': { city: 'Bogotá, D.C.', department: 'Bogotá D.C.' },
  
  // Cartagena
  'cartagena': { city: 'Cartagena de Indias', department: 'Bolívar' },
  'cartagena de indias': { city: 'Cartagena de Indias', department: 'Bolívar' },
  
  // Medellín
  'medellin': { city: 'Medellín', department: 'Antioquia' },
  'medellín': { city: 'Medellín', department: 'Antioquia' },
  
  // Cali
  'cali': { city: 'Cali', department: 'Valle del Cauca' },
  'santiago de cali': { city: 'Cali', department: 'Valle del Cauca' },
  
  // Barranquilla
  'barranquilla': { city: 'Barranquilla', department: 'Atlántico' },
  
  // Bucaramanga
  'bucaramanga': { city: 'Bucaramanga', department: 'Santander' },
  
  // Ciudades con nombres especiales
  'ubate': { city: 'Villa de San Diego de Ubaté', department: 'Cundinamarca' },
  'ubaté': { city: 'Villa de San Diego de Ubaté', department: 'Cundinamarca' },
  'villa de san diego de ubate': { city: 'Villa de San Diego de Ubaté', department: 'Cundinamarca' },
  'villapinzon': { city: 'Villapinzón', department: 'Cundinamarca' },
  'villa pinzon': { city: 'Villapinzón', department: 'Cundinamarca' },
  'villapinzón': { city: 'Villapinzón', department: 'Cundinamarca' },
  'buga': { city: 'Guadalajara de Buga', department: 'Valle del Cauca' },
  'guadalajara de buga': { city: 'Guadalajara de Buga', department: 'Valle del Cauca' },
  'santa marta': { city: 'Santa Marta', department: 'Magdalena' },
  'pereira': { city: 'Pereira', department: 'Risaralda' },
  'manizales': { city: 'Manizales', department: 'Caldas' },
  'ibague': { city: 'Ibagué', department: 'Tolima' },
  'ibagué': { city: 'Ibagué', department: 'Tolima' },
  'neiva': { city: 'Neiva', department: 'Huila' },
  'villavicencio': { city: 'Villavicencio', department: 'Meta' },
  'cucuta': { city: 'Cúcuta', department: 'Norte de Santander' },
  'cúcuta': { city: 'Cúcuta', department: 'Norte de Santander' },
  'pasto': { city: 'Pasto', department: 'Nariño' },
  'san juan de pasto': { city: 'Pasto', department: 'Nariño' },
  'monteria': { city: 'Montería', department: 'Córdoba' },
  'montería': { city: 'Montería', department: 'Córdoba' },
  'armenia': { city: 'Armenia', department: 'Quindío' },
  'popayan': { city: 'Popayán', department: 'Cauca' },
  'popayán': { city: 'Popayán', department: 'Cauca' },
  'sincelejo': { city: 'Sincelejo', department: 'Sucre' },
  'valledupar': { city: 'Valledupar', department: 'Cesar' },
  'tunja': { city: 'Tunja', department: 'Boyacá' },
  'florencia': { city: 'Florencia', department: 'Caquetá' },
  'quibdo': { city: 'Quibdó', department: 'Chocó' },
  'quibdó': { city: 'Quibdó', department: 'Chocó' },
  'riohacha': { city: 'Riohacha', department: 'La Guajira' },
  'yopal': { city: 'Yopal', department: 'Casanare' },
  'mocoa': { city: 'Mocoa', department: 'Putumayo' },
  'leticia': { city: 'Leticia', department: 'Amazonas' },
  'arauca': { city: 'Arauca', department: 'Arauca' },
  'san jose del guaviare': { city: 'San José del Guaviare', department: 'Guaviare' },
  'mitu': { city: 'Mitú', department: 'Vaupés' },
  'mitú': { city: 'Mitú', department: 'Vaupés' },
  'puerto carreño': { city: 'Puerto Carreño', department: 'Vichada' },
  'puerto carreno': { city: 'Puerto Carreño', department: 'Vichada' },
  'inirida': { city: 'Inírida', department: 'Guainía' },
  'inírida': { city: 'Inírida', department: 'Guainía' },
  // Soacha y ciudades cercanas a Bogotá
  'soacha': { city: 'Soacha', department: 'Cundinamarca' },
  'chia': { city: 'Chía', department: 'Cundinamarca' },
  'chía': { city: 'Chía', department: 'Cundinamarca' },
  'zipaquira': { city: 'Zipaquirá', department: 'Cundinamarca' },
  'zipaquirá': { city: 'Zipaquirá', department: 'Cundinamarca' },
  'facatativa': { city: 'Facatativá', department: 'Cundinamarca' },
  'facatativá': { city: 'Facatativá', department: 'Cundinamarca' },
  'fusagasuga': { city: 'Fusagasugá', department: 'Cundinamarca' },
  'fusagasugá': { city: 'Fusagasugá', department: 'Cundinamarca' },
  'girardot': { city: 'Girardot', department: 'Cundinamarca' },
  'mosquera': { city: 'Mosquera', department: 'Cundinamarca' },
  'funza': { city: 'Funza', department: 'Cundinamarca' },
  'madrid': { city: 'Madrid', department: 'Cundinamarca' },
  'cajica': { city: 'Cajicá', department: 'Cundinamarca' },
  'cajicá': { city: 'Cajicá', department: 'Cundinamarca' },
  'cota': { city: 'Cota', department: 'Cundinamarca' },
  // Ciudades del Valle del Cauca
  'palmira': { city: 'Palmira', department: 'Valle del Cauca' },
  'buenaventura': { city: 'Buenaventura', department: 'Valle del Cauca' },
  'tulua': { city: 'Tuluá', department: 'Valle del Cauca' },
  'tuluá': { city: 'Tuluá', department: 'Valle del Cauca' },
  'cartago': { city: 'Cartago', department: 'Valle del Cauca' },
  // Ciudades de Antioquia
  'envigado': { city: 'Envigado', department: 'Antioquia' },
  'itagui': { city: 'Itagüí', department: 'Antioquia' },
  'itagüí': { city: 'Itagüí', department: 'Antioquia' },
  'bello': { city: 'Bello', department: 'Antioquia' },
  'rionegro': { city: 'Rionegro', department: 'Antioquia' },
  'sabaneta': { city: 'Sabaneta', department: 'Antioquia' },
  'la estrella': { city: 'La Estrella', department: 'Antioquia' },
  'apartado': { city: 'Apartadó', department: 'Antioquia' },
  'apartadó': { city: 'Apartadó', department: 'Antioquia' },
  // Costa Atlántica
  'soledad': { city: 'Soledad', department: 'Atlántico' },
  'malambo': { city: 'Malambo', department: 'Atlántico' },
  'sabanalarga': { city: 'Sabanalarga', department: 'Atlántico' },
  'magangue': { city: 'Magangué', department: 'Bolívar' },
  'magangué': { city: 'Magangué', department: 'Bolívar' },
  'turbaco': { city: 'Turbaco', department: 'Bolívar' },
  'lorica': { city: 'Lorica', department: 'Córdoba' },
  'cerete': { city: 'Cereté', department: 'Córdoba' },
  'cereté': { city: 'Cereté', department: 'Córdoba' },
  'cienaga': { city: 'Ciénaga', department: 'Magdalena' },
  'ciénaga': { city: 'Ciénaga', department: 'Magdalena' },
};

/**
 * Normaliza el tipo de identificación según documentación DIAN/Alegra
 */
function normalizeIdentificationType(type: unknown): string {
  const t = String(type || '').toUpperCase().trim();
  if (VALID_IDENTIFICATION_TYPES.includes(t)) return t;
  
  // Mapear aliases comunes
  if (t === 'CEDULA' || t === 'CÉDULA' || t === 'CEDULA DE CIUDADANIA' || t === 'CÉDULA DE CIUDADANÍA') return 'CC';
  if (t === 'PASAPORTE') return 'PP';
  if (t === 'CEDULA DE EXTRANJERIA' || t === 'CÉDULA DE EXTRANJERÍA' || t === 'CARNET DE EXTRANJERIA') return 'CE';
  if (t === 'TARJETA DE IDENTIDAD') return 'TI';
  if (t === 'REGISTRO CIVIL') return 'RC';
  if (t === 'TARJETA DE EXTRANJERIA' || t === 'TARJETA DE EXTRANJERÍA') return 'TE';
  if (t === 'PERMISO ESPECIAL DE PERMANENCIA') return 'PEP';
  if (t === 'DOCUMENTO DE IDENTIFICACION EXTRANJERO' || t === 'DOCUMENTO DE IDENTIFICACIÓN EXTRANJERO') return 'DIE';
  
  return 'CC'; // Default: Cédula de ciudadanía
}

/**
 * Alegra (Colombia) valida ciudad/departamento contra su catálogo DIAN.
 * Normalizamos variantes comunes para evitar errores.
 * Fuente: https://developer.alegra.com/reference/colombiaBF
 */
function normalizeAlegraCOAddress(address: unknown): {
  city?: string;
  department?: string;
} {
  const a = (typeof address === "object" && address) ? (address as any) : {};
  const rawCity = normalizeWhitespace(a.city);
  const rawDepartment = normalizeWhitespace(a.department);

  // Normalizar para búsqueda en diccionario
  const cityKey = rawCity
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[.,]/g, '')
    .trim();

  // Buscar en diccionario de normalizaciones
  const normalized = ALEGRA_CITY_NORMALIZATIONS[cityKey];
  if (normalized) {
    console.log(`normalizeAlegraCOAddress: "${rawCity}" -> "${normalized.city}", "${normalized.department}"`);
    return {
      city: normalized.city,
      department: normalized.department,
    };
  }

  // Caso especial Bogotá (fallback para variantes no listadas)
  const isBogotaCity = /\bbogot[aá]\b/i.test(rawCity);
  const isBogotaDept = /\bbogot[aá]\b/i.test(rawDepartment);
  
  if (isBogotaCity || isBogotaDept) {
    console.log(`normalizeAlegraCOAddress: Bogotá fallback para "${rawCity}"`);
    return {
      city: 'Bogotá, D.C.',
      department: 'Bogotá D.C.',
    };
  }

  // Retornar valores originales si no hay normalización
  const out: { city?: string; department?: string } = {};
  if (rawCity) out.city = rawCity;
  if (rawDepartment) out.department = rawDepartment;
  return out;
}

// Helper para pausas entre requests
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Códigos de error transitorios que ameritan reintento
const TRANSIENT_STATUS_CODES = [429, 502, 503, 504];

async function makeAlegraRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
  maxRetries: number = 3,
) {
  const url = `${ALEGRA_API_URL}${endpoint}`;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Alegra] ${method} ${endpoint} (intento ${attempt}/${maxRetries})`);

    const headers: Record<string, string> = {
      Authorization: getAlegraAuthHeader(),
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
      if (attempt === 1) {
        console.log("Request body:", JSON.stringify(body));
      }
    }

    try {
      const response = await fetch(url, options);

      // Alegra casi siempre responde JSON, pero en errores puntuales puede no hacerlo.
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = await response.text();
      }

      // Si es error transitorio y no es el último intento, reintentar con backoff
      if (TRANSIENT_STATUS_CODES.includes(response.status) && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s, max 8s
        
        console.warn(`[Alegra] ${response.status} transitorio. Reintentando en ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        console.error("Alegra API error:", data);

        // Alegra often returns validation errors under `error: [{ message, code, ... }]`
        const alegraDetail =
          (data as any)?.message ||
          (data as any)?.error?.[0]?.message ||
          (data as any)?.error?.message ||
          (typeof data === "string" ? data : undefined);

        // Mensaje más amigable para 503
        const errorMessage = response.status === 503
          ? "Alegra no disponible temporalmente. Intenta en 1 minuto."
          : (alegraDetail || `Error ${response.status} from Alegra API`);

        const err = new Error(errorMessage);
        (err as any).alegra = data;
        (err as any).status = response.status;
        throw err;
      }

      return data;
    } catch (fetchError: any) {
      lastError = fetchError;
      
      // Si es un error de red/timeout y no es el último intento, reintentar
      if (fetchError.name === 'TypeError' && attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[Alegra] Error de red. Reintentando en ${delayMs}ms...`, fetchError.message);
        await sleep(delayMs);
        continue;
      }
      
      // Si ya tiene status (es un error de Alegra), propagar
      if (fetchError.status) {
        throw fetchError;
      }
      
      // Error de red en último intento
      throw fetchError;
    }
  }

  // Si salimos del loop sin retornar, lanzar el último error
  throw lastError || new Error("Error desconocido en Alegra API");
}

async function putMergedContact(contactId: string, patch: any) {
  const current = await makeAlegraRequest(`/contacts/${contactId}`);

  const allowedKeys = [
    "name",
    "email",
    "phonePrimary",
    "mobile",
    "address",
    "identification",
    "identificationType",
    "identificationNumber",
    "kindOfPerson",
    "nameObject",
    "type",
  ] as const;

  const base: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if ((current as any)?.[key] !== undefined) base[key] = (current as any)[key];
  }

  const currentAddress = typeof (current as any)?.address === "object" ? (current as any).address : {};
  const mergedAddress = {
    ...currentAddress,
    ...(patch?.address || {}),
  };

  // Normalize city/department for Colombia to satisfy DIAN validations
  const normalized = normalizeAlegraCOAddress(mergedAddress);
  const finalAddress = {
    ...mergedAddress,
    ...normalized,
  };

  // Ensure identificationType is always present and normalized (required by Alegra Colombia)
  const rawIdType =
    patch?.identificationType ||
    (base as any).identificationType ||
    (current as any)?.identificationObject?.type ||
    "CC";
  const identificationType = normalizeIdentificationType(rawIdType);

  const identificationNumber =
    patch?.identificationNumber ||
    (base as any).identificationNumber ||
    (typeof (base as any).identification === "string" ? (base as any).identification : null) ||
    (current as any)?.identificationObject?.number ||
    String(Date.now());

  const normalizeKindOfPerson = (value: unknown, idType: string) => {
    const v = String(value ?? "").trim().toUpperCase();
    if (v === "PERSON_ENTITY" || v === "LEGAL_ENTITY") return v;
    if (v === "NATURAL_PERSON" || v === "PERSONA_NATURAL" || v === "NATURAL" || v === "PERSON") return "PERSON_ENTITY";
    if (v === "JURIDICA" || v === "PERSONA_JURIDICA" || v === "LEGAL" || v === "COMPANY") return "LEGAL_ENTITY";
    const id = String(idType || "").toUpperCase();
    if (id === "NIT" || id === "RUC" || id === "RUT") return "LEGAL_ENTITY";
    return "PERSON_ENTITY";
  };

  const kindOfPerson = normalizeKindOfPerson(
    patch?.kindOfPerson || (base as any).kindOfPerson || (current as any)?.kindOfPerson,
    String(identificationType),
  );

  // Ensure nameObject is always properly structured (required by Alegra Colombia)
  let nameObject = (current as any)?.nameObject || (base as any).nameObject || patch?.nameObject;
  const fullName = normalizeWhitespace(patch?.name || (base as any).name || (current as any)?.name);

  if (!nameObject || !nameObject.firstName || !nameObject.lastName) {
    const nameParts = fullName.split(" ").filter(Boolean);
    nameObject = {
      firstName: nameParts[0] || "Cliente",
      lastName: nameParts.slice(1).join(" ") || "Sin Apellido",
    };
  }

  const updated = {
    ...base,
    ...patch,
    name: fullName || "Cliente",
    nameObject,
    address: finalAddress,
    identificationType: String(identificationType),
    identificationNumber: String(identificationNumber),
    identification: String(identificationNumber),
    identificationObject: {
      type: String(identificationType),
      number: String(identificationNumber),
    },
    kindOfPerson,
  };

  delete (updated as any).id;

  console.log("Updating contact with:", JSON.stringify(updated, null, 2));
  return await makeAlegraRequest(`/contacts/${contactId}`, "PUT", updated);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    console.log(`Alegra API action: ${action}`);

    let result;

    switch (action) {
      case "test-connection":
        // Test connection by fetching company info
        result = await makeAlegraRequest("/company");
        break;

      case "find-contact": {
        const phone = data?.phone;
        const identification = data?.identification;
        const email = data?.email;

        result = await findContactInAlegra({ phone, identification, email });
        break;
      }

      case "get-contacts":
        // Get all contacts/clients
        result = await makeAlegraRequest("/contacts");
        break;

      case "get-contact":
        // Get specific contact
        result = await makeAlegraRequest(`/contacts/${data.contactId}`);
        break;

      case "update-contact": {
        const contactId = data?.contactId;
        const patch = data?.patch || {};

        if (!contactId) {
          throw new Error("contactId requerido");
        }

        result = await putMergedContact(String(contactId), patch);
        break;
      }

      case "create-contact": {
        // Create a new contact
        const contact = data?.contact || {};

        // Normalize identification fields because Alegra validates them strictly
        const rawType =
          contact.identificationType ||
          contact.identificationObject?.type ||
          contact.identification?.type ||
          "CC";
        const rawNumber =
          contact.identificationNumber ||
          contact.identificationObject?.number ||
          contact.identification?.number ||
          contact.identification;

        // Usar función de normalización para validar tipo de identificación según DIAN
        let identificationType = normalizeIdentificationType(rawType);
        let identificationNumber = String(rawNumber || "").trim();

        // Ensure we send a numeric identification number (Alegra commonly expects digits)
        const digitsOnly = identificationNumber.replace(/\D/g, "");
        identificationNumber = digitsOnly || identificationNumber;
        if (!identificationNumber) {
          identificationNumber = String(Date.now());
        }

        const normalizeKindOfPerson = (value: unknown, idType: string) => {
          const v = String(value ?? "").trim().toUpperCase();
          if (v === "PERSON_ENTITY" || v === "LEGAL_ENTITY") return v;

          // Common aliases we may receive from UI or other systems
          if (
            v === "NATURAL_PERSON" ||
            v === "PERSONA_NATURAL" ||
            v === "NATURAL" ||
            v === "PERSON"
          ) {
            return "PERSON_ENTITY";
          }

          if (
            v === "JURIDICA" ||
            v === "PERSONA_JURIDICA" ||
            v === "LEGAL" ||
            v === "COMPANY"
          ) {
            return "LEGAL_ENTITY";
          }

          // Sensible default based on identification type
          const id = String(idType || "").toUpperCase();
          if (id === "NIT" || id === "RUC" || id === "RUT") return "LEGAL_ENTITY";
          return "PERSON_ENTITY";
        };

        // Build nameObject from name field (Alegra Colombia requires this)
        const fullName = normalizeWhitespace(contact.name);
        const nameParts = fullName.split(" ").filter(Boolean);
        const firstName = nameParts[0] || "Cliente";
        const lastName = nameParts.slice(1).join(" ") || "Sin Apellido";

        // Normalize address for DIAN
        const address = contact.address || {};
        const addressNormalized = {
          ...address,
          ...normalizeAlegraCOAddress(address),
        };

        const normalizedContact = {
          ...contact,
          address: addressNormalized,
          identificationType,
          identificationNumber,
          // Required by Alegra (tipo de persona)
          kindOfPerson: normalizeKindOfPerson(contact.kindOfPerson, identificationType),
          // Alegra Colombia requires nameObject with firstName and lastName
          nameObject: {
            firstName,
            lastName,
          },
          // Alegra expects `identification` as a string in many endpoints
          identification: identificationNumber,
          // Some responses use `identificationObject`; include it for compatibility
          identificationObject: { type: identificationType, number: identificationNumber },
        };

        // Remove object-shaped identification to avoid confusing the API
        if (typeof (normalizedContact as any).identification === "object") {
          (normalizedContact as any).identification = identificationNumber;
        }

        try {
          result = await makeAlegraRequest("/contacts", "POST", normalizedContact);
        } catch (e) {
          const alegra = (e as any)?.alegra;

          // If contact already exists, Alegra returns code 2006 with contactId.
          if (alegra?.code === 2006 && alegra?.contactId) {
            console.log(
              "Contact already exists, fetching existing contact:",
              alegra.contactId,
            );
            result = await makeAlegraRequest(`/contacts/${alegra.contactId}`);
          } else {
            throw e;
          }
        }
        break;
      }

      case "get-items": {
        // Get all items/products with pagination support
        const start = data?.start || 0;
        const limit = Math.min(data?.limit || 30, 30);
        const search = data?.search;
        
        let endpoint = `/items?start=${start}&limit=${limit}`;
        if (search) {
          endpoint += `&name=${encodeURIComponent(search)}`;
        }
        
        console.log(`Fetching Alegra items: ${endpoint}`);
        result = await makeAlegraRequest(endpoint);
        console.log(`Found ${Array.isArray(result) ? result.length : 0} items`);
        break;
      }

      case "create-invoice":
        // Create an invoice
        console.log("Creating invoice with data:", JSON.stringify(data.invoice, null, 2));
        result = await makeAlegraRequest("/invoices", "POST", data.invoice);
        console.log("Invoice created:", JSON.stringify(result, null, 2));
        break;

      case "get-invoices": {
        // Get all invoices with optional params - CLAMP limit to 30 (Alegra max)
        const rawParams = data?.params || {};
        if (rawParams.limit) {
          rawParams.limit = String(Math.min(Math.max(Number(rawParams.limit) || 30, 0), 30));
        }
        const params = Object.keys(rawParams).length > 0
          ? `?${new URLSearchParams(rawParams).toString()}`
          : "";
        result = await makeAlegraRequest(`/invoices${params}`);
        break;
      }

      case "search-invoices": {
        // Search invoices by orderNumber - paginate with limit=30 (Alegra max)
        const orderNumber = data.orderNumber;
        const query = data.query;
        
        console.log(`search-invoices: Searching for orderNumber=${orderNumber}, query=${query}`);
        
        const pageSize = 30; // Alegra max limit
        const maxPages = 10; // Up to 300 invoices
        const allInvoices: any[] = [];
        
        // Paginate through invoices
        for (let page = 0; page < maxPages; page++) {
          const start = page * pageSize;
          const params = new URLSearchParams();
          params.set('start', String(start));
          params.set('limit', String(pageSize));
          params.set('order_field', 'date');
          params.set('order_direction', 'DESC');
          
          console.log(`search-invoices: Fetching page ${page} (start=${start})`);
          const pageData = await makeAlegraRequest(`/invoices?${params.toString()}`);
          
          if (!Array.isArray(pageData) || pageData.length === 0) {
            console.log(`search-invoices: No more invoices at page ${page}`);
            break;
          }
          
          allInvoices.push(...pageData);
          
          // Early exit if we found matches and are searching by orderNumber
          if (orderNumber) {
            const searchPattern = `Pedido Shopify #${orderNumber}`;
            const foundInPage = pageData.filter((inv: any) => 
              inv.observations?.includes(searchPattern)
            );
            if (foundInPage.length > 0) {
              console.log(`search-invoices: Found ${foundInPage.length} matches in page ${page}, stopping early`);
              break;
            }
          }
          
          // Stop if page is incomplete
          if (pageData.length < pageSize) {
            console.log(`search-invoices: Last page reached (${pageData.length} items)`);
            break;
          }
        }
        
        console.log(`search-invoices: Total fetched ${allInvoices.length} invoices, filtering...`);
        
        // Filter locally by observations field
        if (orderNumber) {
          const searchPattern = `Pedido Shopify #${orderNumber}`;
          const filtered = allInvoices.filter((inv: any) => 
            inv.observations?.includes(searchPattern)
          );
          console.log(`search-invoices: Found ${filtered.length} invoices matching orderNumber ${orderNumber}`);
          result = filtered;
        } else if (query) {
          // General query search in observations or invoice number
          const filtered = allInvoices.filter((inv: any) => 
            inv.observations?.includes(query) ||
            inv.numberTemplate?.fullNumber?.includes(query)
          );
          console.log(`search-invoices: Found ${filtered.length} invoices matching query "${query}"`);
          result = filtered;
        } else {
          result = allInvoices;
        }
        break;
      }

      case "search-invoices-by-client": {
        // Search invoices by client identification + amount (for Shopify-created invoices)
        const { identificationNumber, email, totalAmount, dateRange } = data;
        
        console.log(`search-invoices-by-client: Searching by identification=${identificationNumber}, email=${email}, total=${totalAmount}`);
        
        // 1. First find the client in Alegra
        let clientId: string | null = null;
        
        if (identificationNumber) {
          // Search by identification number
          const contacts = await makeAlegraRequest(`/contacts?identification=${encodeURIComponent(identificationNumber)}`);
          if (Array.isArray(contacts) && contacts.length > 0) {
            clientId = String(contacts[0].id);
            console.log(`search-invoices-by-client: Found client by identification: ${contacts[0].name} (ID: ${clientId})`);
          }
        }
        
        // Fallback: search by email
        if (!clientId && email) {
          const contacts = await makeAlegraRequest(`/contacts?email=${encodeURIComponent(email)}`);
          if (Array.isArray(contacts) && contacts.length > 0) {
            clientId = String(contacts[0].id);
            console.log(`search-invoices-by-client: Found client by email: ${contacts[0].name} (ID: ${clientId})`);
          }
        }
        
        if (!clientId) {
          console.log(`search-invoices-by-client: No client found`);
          result = [];
          break;
        }
        
        // 2. Get recent invoices for this client
        const days = dateRange || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const invoices = await makeAlegraRequest(`/invoices?client=${clientId}&start_date=${startDateStr}&order_direction=DESC&limit=30`);
        
        if (!Array.isArray(invoices) || invoices.length === 0) {
          console.log(`search-invoices-by-client: No invoices found for client ${clientId}`);
          result = [];
          break;
        }
        
        console.log(`search-invoices-by-client: Found ${invoices.length} invoices for client`);
        
        // 3. Filter by total amount (tolerance of $500 for rounding)
        const tolerance = 500;
        const targetTotal = parseFloat(String(totalAmount)) || 0;
        
        const matchingInvoices = invoices.filter((inv: any) => {
          const invoiceTotal = parseFloat(inv.total || inv.totalAmount || 0);
          const diff = Math.abs(invoiceTotal - targetTotal);
          return diff <= tolerance;
        });
        
        console.log(`search-invoices-by-client: ${matchingInvoices.length} invoices match amount ${targetTotal} (±${tolerance})`);
        
        result = matchingInvoices;
        break;
      }

      case "get-invoice": {
        // Get specific invoice - supports both data.invoiceId and data.id
        const invoiceIdForGet = data?.invoiceId || data?.id;
        if (!invoiceIdForGet) {
          throw new Error("ID de factura requerido para get-invoice");
        }
        console.log(`📄 Obteniendo detalles de factura ${invoiceIdForGet}...`);
        result = await makeAlegraRequest(`/invoices/${invoiceIdForGet}`);
        console.info("Alegra API get-invoice completed successfully");
        break;
      }

      case "get-invoice-pdf":
        // Get invoice PDF
        result = await makeAlegraRequest(`/invoices/${data.invoiceId}/pdf`);
        break;

      case "send-invoice-email":
        // Send invoice by email
        result = await makeAlegraRequest(
          `/invoices/${data.invoiceId}/email`,
          "POST",
          data.emailData,
        );
        break;

      case "stamp-invoices": {
        // Stamp invoices with DIAN (electronic invoicing) - max 10 per request
        if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
          throw new Error("Se requiere un array de IDs de facturas (máximo 10)");
        }
        if (data.ids.length > 10) {
          throw new Error("Máximo 10 facturas por solicitud de emisión");
        }

        console.log(`Stamping invoices with DIAN: ${data.ids.join(", ")}`);

        // Best-effort auto-fix: normalize client city/department before stamping.
        // This prevents DIAN validation errors caused by variants like "Bogota".
        for (const invoiceId of data.ids) {
          try {
            const invoice = await makeAlegraRequest(`/invoices/${invoiceId}`);
            const clientId = invoice?.client?.id;
            const invoiceAddress = invoice?.client?.address;
            if (!clientId || !invoiceAddress) continue;

            const normalized = normalizeAlegraCOAddress(invoiceAddress);
            const needsUpdate =
              (normalized.city && normalized.city !== invoiceAddress.city) ||
              (normalized.department && normalized.department !== invoiceAddress.department);

            if (needsUpdate) {
              console.log(
                "Normalizing client address before stamping",
                JSON.stringify(
                  {
                    invoiceId,
                    clientId,
                    from: {
                      city: invoiceAddress.city,
                      department: invoiceAddress.department,
                    },
                    to: normalized,
                  },
                  null,
                  2,
                ),
              );

              await putMergedContact(String(clientId), {
                address: {
                  city: normalized.city,
                  department: normalized.department,
                },
              });
            }
          } catch (e) {
            console.error("Failed to normalize address before stamping", {
              invoiceId,
              message: (e as any)?.message,
            });
          }
        }

        const stampResponse = await makeAlegraRequest("/invoices/stamp", "POST", { ids: data.ids });
        console.log("Stamp response from Alegra:", JSON.stringify(stampResponse, null, 2));
        
        // The stamp endpoint doesn't return CUFE, so we need to fetch full invoice details
        // after stamping to get the CUFE and complete information
        const enrichedResults = [];
        const stampResults = Array.isArray(stampResponse) ? stampResponse : [stampResponse];
        
        for (const stampResult of stampResults) {
          const invoiceId = stampResult?.id;
          if (!invoiceId) {
            enrichedResults.push(stampResult);
            continue;
          }
          
          try {
            // Fetch full invoice details including CUFE
            console.log(`Fetching full invoice details for ${invoiceId}...`);
            const fullInvoice = await makeAlegraRequest(`/invoices/${invoiceId}`);
            console.log(`Invoice ${invoiceId} CUFE: ${fullInvoice?.stamp?.cufe || 'N/A'}`);
            
            enrichedResults.push({
              ...fullInvoice,
              _stampMessage: stampResult.message || stampResult.emissionStatus,
              _stampSuccess: true
            });
          } catch (fetchError) {
            console.error(`Failed to fetch invoice ${invoiceId} details after stamping:`, fetchError);
            enrichedResults.push({
              ...stampResult,
              _stampSuccess: true,
              _fetchError: (fetchError as any)?.message
            });
          }
        }
        
        result = enrichedResults;
        break;
      }

      // Duplicate get-invoice case removed - consolidated above at line 824

      case "get-resolutions":
        // Get DIAN resolutions
        result = await makeAlegraRequest("/number-templates");
        break;

      case "get-payment-methods":
        // Get payment methods
        result = await makeAlegraRequest("/payment-methods");
        break;

      case "get-taxes":
        // Get available taxes
        result = await makeAlegraRequest("/taxes");
        break;

      case "get-bank-accounts":
        // Get available bank accounts for payments
        result = await makeAlegraRequest("/bank-accounts");
        break;

      case "create-payment": {
        // Create a payment associated with an invoice
        const payment = data?.payment || {};
        
        if (!payment.invoiceId) {
          throw new Error("invoiceId requerido para crear pago");
        }
        
        const paymentPayload = {
          date: payment.date || new Date().toISOString().split('T')[0],
          type: "in", // Ingreso (cobro)
          bankAccount: payment.bankAccount || 1, // Cuenta predeterminada
          paymentMethod: payment.paymentMethod || "cash",
          invoices: [{
            id: payment.invoiceId,
            amount: payment.amount
          }],
          observations: payment.observations || ""
        };
        
        console.log("Creating payment:", JSON.stringify(paymentPayload, null, 2));
        result = await makeAlegraRequest("/payments", "POST", paymentPayload);
        console.log("Payment created:", JSON.stringify(result, null, 2));
        break;
      }

      default:
        throw new Error(`Acción no reconocida: ${action}`);
    }

    console.log(`Alegra API ${action} completed successfully`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in alegra-api function:", error);

    const status =
      typeof error?.status === "number" && Number.isFinite(error.status)
        ? error.status
        : 500;

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Error desconocido",
      }),
      {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
