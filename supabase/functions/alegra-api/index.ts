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
}) {
  const phone = normalizeCOPhone(params.phone);
  const identification = normalizeDigits(params.identification);
  const email = normalizeWhitespace(params.email).toLowerCase();

  const pageSize = 30;
  const maxPages = 200; // hasta 6000 contactos (corta antes si se acaban)

  const fetchPage = async (start: number) =>
    await makeAlegraRequest(`/contacts?type=client&start=${start}&limit=${pageSize}`);

  // 1) Buscar por teléfono (requiere paginación; Alegra no filtra por phone)
  if (phone) {
    for (let page = 0; page < maxPages; page++) {
      const start = page * pageSize;
      const pageData = await fetchPage(start);
      if (!Array.isArray(pageData) || pageData.length === 0) break;

      const found = pageData.find((c: any) => {
        const p1 = normalizeCOPhone(c.phonePrimary);
        const p2 = normalizeCOPhone(c.mobile);
        return (p1 && p1 === phone) || (p2 && p2 === phone);
      });

      if (found) {
        return { found: true, matchedBy: "phone", contact: found };
      }
    }
  }

  // 2) Buscar por cédula/identificación (Alegra sí filtra por identificación)
  if (identification) {
    const byId = await makeAlegraRequest(
      `/contacts?type=client&identification=${encodeURIComponent(identification)}&start=0&limit=${pageSize}`,
    );
    if (Array.isArray(byId) && byId.length > 0) {
      return { found: true, matchedBy: "identification", contact: byId[0] };
    }
  }

  // 3) Buscar por email (requiere paginación; Alegra no filtra por email)
  if (email) {
    for (let page = 0; page < maxPages; page++) {
      const start = page * pageSize;
      const pageData = await fetchPage(start);
      if (!Array.isArray(pageData) || pageData.length === 0) break;

      const found = pageData.find((c: any) => {
        const cEmail = normalizeWhitespace(c.email).toLowerCase();
        return cEmail && cEmail === email;
      });

      if (found) {
        return { found: true, matchedBy: "email", contact: found };
      }
    }
  }

  return { found: false, matchedBy: "created", contact: null };
}

/**
 * Alegra (Colombia) valida ciudad/departamento contra su catálogo DIAN.
 * Normalizamos variantes comunes para evitar errores como:
 * - "Bogota" -> "Bogotá"
 * - "Bogota D.C." -> "Bogotá, D.C."
 */
function normalizeAlegraCOAddress(address: unknown): {
  city?: string;
  department?: string;
} {
  const a = (typeof address === "object" && address) ? (address as any) : {};
  const rawCity = normalizeWhitespace(a.city);
  const rawDepartment = normalizeWhitespace(a.department);

  const cityLower = rawCity.toLowerCase().replace(/\./g, "");
  const deptLower = rawDepartment.toLowerCase().replace(/\./g, "");

  let city = rawCity;
  let department = rawDepartment;

  // --- Bogotá ---
  // city: "Bogotá, DC", department: "Bogotá D.C." (formato DIAN)
  const isBogotaCity = /\bbogot(a|á)\b/i.test(cityLower);
  const isBogotaDept = /\bbogot(a|á)\b/i.test(deptLower) || /\bcundinamarca\b/i.test(deptLower);

  // Si es Bogotá (ciudad o departamento), normalizar a formato DIAN
  if (isBogotaCity || isBogotaDept) {
    city = "Bogotá, DC";
    department = "Bogotá D.C.";
  }

  const out: { city?: string; department?: string } = {};
  if (city) out.city = city;
  if (department) out.department = department;
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

  // Ensure identificationType is always present (required by Alegra Colombia)
  const identificationType =
    patch?.identificationType ||
    (base as any).identificationType ||
    (current as any)?.identificationObject?.type ||
    "CC";

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

        let identificationType = String(rawType || "CC").trim() || "CC";
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
        // Search invoices by query (useful for finding by observations field)
        const searchQuery = data.query
          ? `?query=${encodeURIComponent(data.query)}`
          : "";
        result = await makeAlegraRequest(`/invoices${searchQuery}`);
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
