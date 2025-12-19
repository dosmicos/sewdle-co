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
        
      case 'create-contact':
        // Create a new contact
        result = await makeAlegraRequest('/contacts', 'POST', data.contact);
        break;
        
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
