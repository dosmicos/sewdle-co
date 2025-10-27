import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { product_id, variant_id } = await req.json();

    if (!product_id) {
      return new Response(
        JSON.stringify({ error: 'product_id es requerido' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get Shopify credentials
    const rawStoreDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const accessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    
    const storeDomain = rawStoreDomain?.includes('.myshopify.com') 
      ? rawStoreDomain.replace('.myshopify.com', '')
      : rawStoreDomain;

    if (!storeDomain || !accessToken) {
      console.error('❌ Missing Shopify credentials');
      return new Response(
        JSON.stringify({ error: 'Credenciales de Shopify no configuradas' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🖼️ Fetching image for product ${product_id}, variant ${variant_id}`);

    // Fetch specific product from Shopify
    const apiUrl = `https://${storeDomain}.myshopify.com/admin/api/2023-10/products/${product_id}.json`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Shopify API Error: ${response.status}`, errorText);
      return new Response(
        JSON.stringify({ error: 'Error al obtener producto de Shopify', image_url: null }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();
    const product = data.product;

    if (!product) {
      console.warn(`⚠️ Product ${product_id} not found`);
      return new Response(
        JSON.stringify({ image_url: null }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let imageUrl: string | null = null;

    // Try to get variant-specific image first
    if (variant_id && product.variants) {
      const variant = product.variants.find((v: any) => v.id === variant_id);
      if (variant?.image_id && product.images) {
        const variantImage = product.images.find((img: any) => img.id === variant.image_id);
        if (variantImage?.src) {
          imageUrl = variantImage.src;
          console.log(`✅ Found variant-specific image for variant ${variant_id}`);
        }
      }
    }

    // Fallback to product main image
    if (!imageUrl) {
      imageUrl = product.image?.src || product.images?.[0]?.src || null;
      if (imageUrl) {
        console.log(`✅ Using product main image for product ${product_id}`);
      } else {
        console.warn(`⚠️ No image found for product ${product_id}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        image_url: imageUrl,
        product_id,
        variant_id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Error in get-shopify-variant-image:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al obtener imagen',
        details: error.message,
        image_url: null 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
