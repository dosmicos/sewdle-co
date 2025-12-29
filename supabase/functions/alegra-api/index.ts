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

  const pageSize = 30;
  const maxPages = 100; // hasta 3000 contactos

  console.log("findContactInAlegra - Buscando:", { phone, identification, email });

  // Helper para detectar rate limit
  const isRateLimitError = (e: any) => {
    const msg = String(e?.message || e?.alegra?.message || "").toLowerCase();
    return msg.includes("too many requests") || msg.includes("rate limit") || e?.status === 429;
  };

  // 1) Buscar por cédula/identificación PRIMERO (1 request, más eficiente)
  if (identification) {
    try {
      console.log("findContactInAlegra - Buscando por identificación:", identification);
      const byId = await makeAlegraRequest(
        `/contacts?type=client&identification=${encodeURIComponent(identification)}&start=0&limit=${pageSize}`,
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

  // 2) Buscar por teléfono Y email en UNA SOLA paginación (reduce requests)
  if (phone || email) {
    try {
      for (let page = 0; page < maxPages; page++) {
        const start = page * pageSize;
        console.log(`findContactInAlegra - Paginando contactos (page ${page}, start ${start})`);
        
        const pageData = await makeAlegraRequest(`/contacts?type=client&start=${start}&limit=${pageSize}`);
        if (!Array.isArray(pageData) || pageData.length === 0) {
          console.log("findContactInAlegra - Fin de paginación, no más contactos");
          break;
        }

        // Buscar por teléfono en esta página
        if (phone) {
          const foundByPhone = pageData.find((c: any) => {
            const p1 = normalizeCOPhone(c.phonePrimary);
            const p2 = normalizeCOPhone(c.mobile);
            return (p1 && p1 === phone) || (p2 && p2 === phone);
          });
          if (foundByPhone) {
            console.log("findContactInAlegra - Encontrado por teléfono:", foundByPhone.id, foundByPhone.name);
            return { found: true, matchedBy: "phone", contact: foundByPhone };
          }
        }

        // Buscar por email en esta página
        if (email) {
          const foundByEmail = pageData.find((c: any) => {
            const cEmail = normalizeWhitespace(c.email).toLowerCase();
            return cEmail && cEmail === email;
          });
          if (foundByEmail) {
            console.log("findContactInAlegra - Encontrado por email:", foundByEmail.id, foundByEmail.name);
            return { found: true, matchedBy: "email", contact: foundByEmail };
          }
        }

        // Si la página está incompleta, no hay más datos
        if (pageData.length < pageSize) {
          console.log("findContactInAlegra - Última página alcanzada");
          break;
        }
      }
    } catch (e: any) {
      if (isRateLimitError(e)) {
        console.warn("findContactInAlegra - Rate limit en paginación");
        return { found: false, matchedBy: "rate_limited", contact: null, rateLimited: true, retryAfterSec: 20 };
      }
      console.error("findContactInAlegra - Error en paginación:", e.message);
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

async function makeAlegraRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
) {
  const url = `${ALEGRA_API_URL}${endpoint}`;

  console.log(`Making Alegra API request: ${method} ${url}`);

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
    console.log("Request body:", JSON.stringify(body));
  }

  const response = await fetch(url, options);

  // Alegra casi siempre responde JSON, pero en errores puntuales puede no hacerlo.
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }

  if (!response.ok) {
    console.error("Alegra API error:", data);

    // Alegra often returns validation errors under `error: [{ message, code, ... }]`
    const alegraDetail =
      (data as any)?.message ||
      (data as any)?.error?.[0]?.message ||
      (data as any)?.error?.message ||
      (typeof data === "string" ? data : undefined);

    const err = new Error(alegraDetail || `Error ${response.status} from Alegra API`);
    (err as any).alegra = data;
    (err as any).status = response.status;
    throw err;
  }

  return data;
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

      case "get-items":
        // Get all items/products
        result = await makeAlegraRequest("/items");
        break;

      case "create-invoice":
        // Create an invoice
        console.log("Creating invoice with data:", JSON.stringify(data.invoice, null, 2));
        result = await makeAlegraRequest("/invoices", "POST", data.invoice);
        console.log("Invoice created:", JSON.stringify(result, null, 2));
        break;

      case "get-invoices": {
        // Get all invoices with optional params
        const params = data?.params
          ? `?${new URLSearchParams(data.params).toString()}`
          : "";
        result = await makeAlegraRequest(`/invoices${params}`);
        break;
      }

      case "search-invoices": {
        // Search invoices by orderNumber - fetch recent and filter locally by observations
        // Alegra's query param doesn't reliably search in observations field
        const orderNumber = data.orderNumber;
        const query = data.query;
        
        console.log(`search-invoices: Fetching recent invoices to find orderNumber=${orderNumber}, query=${query}`);
        
        // Fetch last 100 invoices, ordered by date descending
        const params = new URLSearchParams();
        params.set('limit', '100');
        params.set('order_field', 'date');
        params.set('order_direction', 'DESC');
        
        const allInvoices = await makeAlegraRequest(`/invoices?${params.toString()}`);
        
        if (!Array.isArray(allInvoices)) {
          console.log('search-invoices: No invoices returned from Alegra');
          result = [];
          break;
        }
        
        console.log(`search-invoices: Fetched ${allInvoices.length} invoices, filtering...`);
        
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

      case "get-invoice":
        // Get specific invoice
        result = await makeAlegraRequest(`/invoices/${data.invoiceId}`);
        break;

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

        result = await makeAlegraRequest("/invoices/stamp", "POST", { ids: data.ids });
        break;
      }

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
