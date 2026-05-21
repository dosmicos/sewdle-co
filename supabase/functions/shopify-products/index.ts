
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// Función de ordenamiento de variantes (copiada desde utils)
const extractAgeRangeStart = (str: string): number => {
  const lowerStr = str.toLowerCase();
  
  const agePatterns = [
    /(\d+)\s*a\s*\d+\s*mes/i,
    /(\d+)\s*-\s*\d+\s*mes/i,
    /(\d+)\s*to\s*\d+\s*month/i,
    /(\d+)\s*mes/i,
    /(\d+)m/i,
  ];

  for (const pattern of agePatterns) {
    const match = lowerStr.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

const getStandardSizeOrder = (size: string): number => {
  const lowerSize = size.toLowerCase().trim();
  const sizeOrder: { [key: string]: number } = {
    'xxxs': 1, '3xs': 1, 'xxs': 2, '2xs': 2, 'xs': 3,
    's': 4, 'small': 4, 'm': 5, 'medium': 5, 'l': 6, 'large': 6,
    'xl': 7, 'xxl': 8, '2xl': 8, 'xxxl': 9, '3xl': 9, '4xl': 10
  };
  return sizeOrder[lowerSize] || 999;
};

const isAgeVariant = (str: string): boolean => {
  const lowerStr = str.toLowerCase();
  return /\d+\s*(a|to|-)\s*\d+\s*(mes|month|año|year)|^\d+\s*(mes|month|m|año|year|y)/.test(lowerStr);
};

const isStandardSize = (str: string): boolean => {
  const lowerStr = str.toLowerCase().trim();
  return ['xxxs', '3xs', 'xxs', '2xs', 'xs', 's', 'small', 'm', 'medium', 'l', 'large', 'xl', 'xxl', '2xl', 'xxxl', '3xl', '4xl'].includes(lowerStr);
};

const sortVariants = (variants: any[]): any[] => {
  return [...variants].sort((a, b) => {
    const aValue = a.title || a.size || '';
    const bValue = b.title || b.size || '';

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    if (isAgeVariant(aValue) && isAgeVariant(bValue)) {
      const aAge = extractAgeRangeStart(aValue);
      const bAge = extractAgeRangeStart(bValue);
      return aAge - bAge;
    }

    if (isStandardSize(aValue) && isStandardSize(bValue)) {
      const aOrder = getStandardSizeOrder(aValue);
      const bOrder = getStandardSizeOrder(bValue);
      return aOrder - bOrder;
    }

    const aNum = extractAgeRangeStart(aValue);
    const bNum = extractAgeRangeStart(bValue);
    if (aNum > 0 && bNum > 0) {
      return aNum - bNum;
    }

    if (isAgeVariant(aValue) && !isAgeVariant(bValue)) return -1;
    if (!isAgeVariant(aValue) && isAgeVariant(bValue)) return 1;

    if (isStandardSize(aValue) && !isStandardSize(bValue)) return -1;
    if (!isStandardSize(aValue) && isStandardSize(bValue)) return 1;

    return aValue.localeCompare(bValue, 'es', { numeric: true });
  });
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔥 SHOPIFY-PRODUCTS FUNCTION STARTED AT:', new Date().toISOString());

    const body = await req.json().catch(() => ({}))
    const { searchTerm = '', storeId } = body

    let storeDomain: string | undefined
    let accessToken: string | undefined

    // If a storeId is provided, look up credentials from the stores table
    if (storeId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const adminClient = createClient(supabaseUrl, supabaseServiceKey)

      const { data: store, error: storeError } = await adminClient
        .from('stores')
        .select('shopify_store_url, shopify_credentials')
        .eq('id', storeId)
        .eq('is_active', true)
        .single()

      if (!storeError && store?.shopify_credentials?.access_token) {
        const rawDomain = store.shopify_store_url?.replace('https://', '').replace('http://', '').replace(/\/$/, '')
        storeDomain = rawDomain?.includes('.myshopify.com')
          ? rawDomain.replace('.myshopify.com', '')
          : rawDomain
        accessToken = store.shopify_credentials.access_token
        console.log(`🏪 Using store credentials from DB for storeId: ${storeId}`)
      } else {
        console.warn('Store not found or missing credentials in DB, falling back to ENV vars')
      }
    }

    // Fallback to ENV vars (Colombia default)
    if (!storeDomain || !accessToken) {
      const rawStoreDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
      accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')
      storeDomain = rawStoreDomain?.includes('.myshopify.com')
        ? rawStoreDomain.replace('.myshopify.com', '')
        : rawStoreDomain
    }

    console.log('📊 Checking credentials...');
    console.log('Store Domain:', storeDomain ? 'CONFIGURED' : 'MISSING');
    console.log('Access Token:', accessToken ? 'CONFIGURED' : 'MISSING');
    console.log(`🔗 Using Shopify domain: ${storeDomain}.myshopify.com`);

    if (!storeDomain || !accessToken) {
      console.error('Missing Shopify credentials')
      return new Response(
        JSON.stringify({
          error: 'Credenciales de Shopify no configuradas. Por favor contacta al administrador.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Limpiar el dominio para asegurar formato correcto
    const cleanDomain = storeDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    // Obtener todos los productos activos y borrador
    let apiUrl = `https://${cleanDomain}.myshopify.com/admin/api/2023-10/products.json?status=active,draft&limit=250&published_status=any`

    console.log('Fetching from Shopify API:', apiUrl)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Shopify API Error: ${response.status} - ${response.statusText}`, errorText)
      throw new Error(`Error de Shopify: ${response.status} - ${response.statusText}`)
    }

    const data = await response.json()
    console.log(`✅ Successfully fetched ${data.products?.length || 0} products from Shopify at ${new Date().toISOString()}`)
    
    // Verificar que tenemos datos válidos
    if (!data.products || !Array.isArray(data.products)) {
      console.error('❌ Invalid response from Shopify API - no products array');
      throw new Error('Invalid response from Shopify API');
    }

    // Procesar los productos
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        if (product.variants && product.variants.length > 0) {
          // ORDENAR LAS VARIANTES ANTES DE PROCESARLAS
          product.variants = sortVariants(product.variants);
          
          for (const variant of product.variants) {
            // Usar la cantidad de inventario básica disponible en la variante
            variant.stock_quantity = variant.inventory_quantity || 0
            
            // Log detallado para variantes específicas que están causando problemas
            if (variant.sku === '46092135956715' || variant.sku === '46581502771435') {
              console.log(`🎯 VARIANT DEBUG - SKU: ${variant.sku}, Stock: ${variant.stock_quantity}, ID: ${variant.id}`);
            }
          }
        }
      }

      // Si hay término de búsqueda, filtrar en el backend también
      if (searchTerm && searchTerm.trim()) {
        const searchTermLower = searchTerm.toLowerCase()
        data.products = data.products.filter((product: any) => 
          product.title.toLowerCase().includes(searchTermLower) ||
          (product.body_html && product.body_html.toLowerCase().includes(searchTermLower)) ||
          (product.product_type && product.product_type.toLowerCase().includes(searchTermLower)) ||
          (product.tags && product.tags.toLowerCase().includes(searchTermLower)) ||
          product.variants.some((variant: any) => 
            (variant.sku && variant.sku.toLowerCase().includes(searchTermLower)) ||
            (variant.title && variant.title.toLowerCase().includes(searchTermLower))
          )
        )
        console.log(`Filtered to ${data.products.length} products matching "${searchTerm}"`)
      }
    }

    // Agregar metadata para validación
    const responseData = {
      ...data,
      _metadata: {
        timestamp: new Date().toISOString(),
        total_products: data.products?.length || 0,
        total_variants: data.products?.reduce((sum: number, p: any) => sum + (p.variants?.length || 0), 0) || 0,
        function_version: '2.0'
      }
    };

    console.log(`📤 Returning ${responseData._metadata.total_products} products with ${responseData._metadata.total_variants} variants`);

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in shopify-products function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Error al conectar con Shopify',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
