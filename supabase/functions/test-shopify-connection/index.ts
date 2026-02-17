import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuthenticatedUser } from "../_shared/auth.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuthenticatedUser(req, corsHeaders);
    if (!authResult.ok) {
      return authResult.response;
    }
    console.log('✅ Authenticated user for test-shopify-connection:', authResult.userId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { storeUrl, accessToken, organizationId } = await req.json();

    console.log('Testing Shopify connection:', { storeUrl, hasToken: !!accessToken, organizationId });

    // If organizationId is provided, get credentials from database
    let finalStoreUrl = storeUrl;
    let finalAccessToken = accessToken;

    if (organizationId && !storeUrl && !accessToken) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('shopify_store_url, shopify_credentials')
        .eq('id', organizationId)
        .single();

      if (orgError) {
        throw new Error('Organization not found');
      }

      finalStoreUrl = org.shopify_store_url;
      finalAccessToken = org.shopify_credentials?.access_token;
    }

    if (!finalStoreUrl || !finalAccessToken) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Store URL and access token are required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    // Normalize store URL
    let normalizedUrl = finalStoreUrl.replace(/^https?:\/\//, '');
    normalizedUrl = normalizedUrl.replace(/\/$/, '');
    
    if (!normalizedUrl.includes('.myshopify.com')) {
      if (!normalizedUrl.includes('.')) {
        normalizedUrl = `${normalizedUrl}.myshopify.com`;
      }
    }
    
    const shopifyApiUrl = `https://${normalizedUrl}`;

    // Test connection by fetching shop information
    const shopifyResponse = await fetch(`${shopifyApiUrl}/admin/api/2023-10/shop.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': finalAccessToken,
        'Content-Type': 'application/json',
      },
    });

    console.log('Shopify API response status:', shopifyResponse.status);

    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      console.error('Shopify API error:', errorText);
      
      let errorMessage = 'Error de conexión con Shopify';
      
      if (shopifyResponse.status === 401) {
        errorMessage = 'Token de acceso inválido. Verifica que el token sea correcto y tenga los permisos necesarios.';
      } else if (shopifyResponse.status === 404) {
        errorMessage = 'Tienda no encontrada. Verifica que la URL de la tienda sea correcta.';
      } else if (shopifyResponse.status === 403) {
        errorMessage = 'Acceso denegado. Verifica que el token tenga los permisos necesarios.';
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const shopData = await shopifyResponse.json();
    console.log('Shop data received:', shopData.shop?.name);

    // Test a second endpoint to verify permissions
    const productsResponse = await fetch(`${shopifyApiUrl}/admin/api/2023-10/products.json?limit=1`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': finalAccessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!productsResponse.ok) {
      console.warn('Products endpoint test failed:', productsResponse.status);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'El token no tiene permisos para leer productos. Verifica los permisos de la aplicación.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conexión exitosa con Shopify',
        storeInfo: {
          name: shopData.shop.name,
          domain: shopData.shop.domain,
          email: shopData.shop.email,
          plan: shopData.shop.plan_name || shopData.shop.plan_display_name
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in test-shopify-connection:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Error interno del servidor'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
