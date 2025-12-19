import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALEGRA_API_URL = 'https://api.alegra.com/api/v1';

function getAlegraAuthHeader(): string {
  const email = Deno.env.get('ALEGRA_USER_EMAIL');
  const token = Deno.env.get('ALEGRA_API_TOKEN');
  
  if (!email || !token) {
    throw new Error('Credenciales de Alegra no configuradas');
  }
  
  const credentials = btoa(`${email}:${token}`);
  return `Basic ${credentials}`;
}

async function makeAlegraRequest(endpoint: string, method: string = 'GET', body?: any) {
  const url = `${ALEGRA_API_URL}${endpoint}`;
  
  console.log(`Making Alegra API request: ${method} ${url}`);
  
  const headers: Record<string, string> = {
    'Authorization': getAlegraAuthHeader(),
    'Content-Type': 'application/json',
  };
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
    console.log('Request body:', JSON.stringify(body));
  }
  
  const response = await fetch(url, options);
  const data = await response.json();
  
  if (!response.ok) {
    console.error('Alegra API error:', data);
    throw new Error(data.message || `Error ${response.status} from Alegra API`);
  }
  
  return data;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    
    console.log(`Alegra API action: ${action}`);
    
    let result;
    
    switch (action) {
      case 'test-connection':
        // Test connection by fetching company info
        result = await makeAlegraRequest('/company');
        break;
        
      case 'get-contacts':
        // Get all contacts/clients
        result = await makeAlegraRequest('/contacts');
        break;
        
      case 'get-contact':
        // Get specific contact
        result = await makeAlegraRequest(`/contacts/${data.contactId}`);
        break;
        
      case 'create-contact': {
        // Create a new contact
        const contact = data?.contact || {};

        // Normalize identification fields because Alegra validates them strictly
        const rawType = contact.identificationType || contact.identificationObject?.type || contact.identification?.type || 'CC';
        let rawNumber = contact.identificationNumber || contact.identificationObject?.number || contact.identification?.number || contact.identification;

        let identificationType = String(rawType || 'CC').trim() || 'CC';
        let identificationNumber = String(rawNumber || '').trim();

        // Ensure we send a numeric identification number (Alegra commonly expects digits)
        const digitsOnly = identificationNumber.replace(/\D/g, '');
        identificationNumber = digitsOnly || identificationNumber;
        if (!identificationNumber) {
          identificationNumber = String(Date.now());
        }

        const normalizeKindOfPerson = (value: unknown, idType: string) => {
          const v = String(value ?? '').trim().toUpperCase();
          if (v === 'PERSON_ENTITY' || v === 'LEGAL_ENTITY') return v;

          // Common aliases we may receive from UI or other systems
          if (
            v === 'NATURAL_PERSON' ||
            v === 'PERSONA_NATURAL' ||
            v === 'NATURAL' ||
            v === 'PERSON'
          ) {
            return 'PERSON_ENTITY';
          }

          if (
            v === 'JURIDICA' ||
            v === 'PERSONA_JURIDICA' ||
            v === 'LEGAL' ||
            v === 'COMPANY'
          ) {
            return 'LEGAL_ENTITY';
          }

          // Sensible default based on identification type
          const id = String(idType || '').toUpperCase();
          if (id === 'NIT' || id === 'RUC' || id === 'RUT') return 'LEGAL_ENTITY';
          return 'PERSON_ENTITY';
        };

        const normalizedContact = {
          ...contact,
          identificationType,
          identificationNumber,
          // Required by Alegra (tipo de persona)
          kindOfPerson: normalizeKindOfPerson(contact.kindOfPerson, identificationType),
          // Alegra expects `identification` as a string in many endpoints
          identification: identificationNumber,
          // Some responses use `identificationObject`; include it for compatibility
          identificationObject: { type: identificationType, number: identificationNumber },
        };

        // Remove object-shaped identification to avoid confusing the API
        if (typeof (normalizedContact as any).identification === 'object') {
          (normalizedContact as any).identification = identificationNumber;
        }

        result = await makeAlegraRequest('/contacts', 'POST', normalizedContact);
        break;
      }
        
      case 'get-items':
        // Get all items/products
        result = await makeAlegraRequest('/items');
        break;
        
      case 'create-invoice':
        // Create an invoice
        result = await makeAlegraRequest('/invoices', 'POST', data.invoice);
        break;
        
      case 'get-invoices':
        // Get all invoices with optional params
        const params = data?.params ? `?${new URLSearchParams(data.params).toString()}` : '';
        result = await makeAlegraRequest(`/invoices${params}`);
        break;
        
      case 'search-invoices':
        // Search invoices by query (useful for finding by observations field)
        const searchQuery = data.query ? `?query=${encodeURIComponent(data.query)}` : '';
        result = await makeAlegraRequest(`/invoices${searchQuery}`);
        break;
        
      case 'get-invoice':
        // Get specific invoice
        result = await makeAlegraRequest(`/invoices/${data.invoiceId}`);
        break;
        
      case 'get-invoice-pdf':
        // Get invoice PDF
        result = await makeAlegraRequest(`/invoices/${data.invoiceId}/pdf`);
        break;
        
      case 'send-invoice-email':
        // Send invoice by email
        result = await makeAlegraRequest(`/invoices/${data.invoiceId}/email`, 'POST', data.emailData);
        break;
        
      case 'stamp-invoices':
        // Stamp invoices with DIAN (electronic invoicing) - max 10 per request
        if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
          throw new Error('Se requiere un array de IDs de facturas (máximo 10)');
        }
        if (data.ids.length > 10) {
          throw new Error('Máximo 10 facturas por solicitud de emisión');
        }
        console.log(`Stamping invoices with DIAN: ${data.ids.join(', ')}`);
        result = await makeAlegraRequest('/invoices/stamp', 'POST', { ids: data.ids });
        break;
        
      case 'get-resolutions':
        // Get DIAN resolutions
        result = await makeAlegraRequest('/number-templates');
        break;
        
      case 'get-payment-methods':
        // Get payment methods
        result = await makeAlegraRequest('/payment-methods');
        break;
        
      case 'get-taxes':
        // Get available taxes
        result = await makeAlegraRequest('/taxes');
        break;
        
      default:
        throw new Error(`Acción no reconocida: ${action}`);
    }
    
    console.log(`Alegra API ${action} completed successfully`);
    
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error: any) {
    console.error('Error in alegra-api function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Error desconocido' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
